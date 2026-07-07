import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  batchDeleteTickets,
  batchReviewTickets,
  batchUpdateTicketPriority,
  batchUpdateTicketStatus,
  createTicket,
  createTicketCategory,
  deleteTicket,
  getPendingReviewTickets,
  getTicketById,
  getTicketCategories,
  getTicketPublishStats,
  getTickets,
  getTicketsByUserId,
  getUnpublishedActiveTickets,
  getVisibleTickets,
  incrementTicketViewCount,
  invalidateTicketCache,
  logTicketActivity,
  restoreTicket,
  reviewTicket,
  updateTicket,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import { isValidStatusTransition } from "@/lib/ticket-status-machine";
import { isAdmin } from "@/lib/utils";

const ticketSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(128, "标题最长 128 个字符"),
  description: z
    .string()
    .min(1, "描述不能为空")
    .max(512, "描述最长 512 个字符"),
  content: z.string().max(4096, "详情最长 4096 个字符").nullable().default(null),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z
    .enum(["pending", "in_progress", "completed", "closed"])
    .default("pending"),
  progress: z.number().int().min(0).max(100).default(0),
  assignee: z.string().max(64, "负责人最长 64 个字符").nullable().default(null),
  phone: z.string().max(20, "手机号最长 20 个字符").nullable().default(null),
  dueDate: z.string().datetime().nullable().default(null),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  categoryId: z.string().uuid().nullable().default(null),
  visibility: z.enum(["public", "private"]).default("public"),
  // 🆕 AI 解析产出的结构化表单 Blob URL（向后兼容，新数据优先存 formData）
  formSchemaUrl: z
    .string()
    .url()
    .optional()
    .describe("Vercel Blob 中结构化表单 JSON 的公开访问 URL"),
  // 🆕 AI 解析推断的类目名称，用于自动归类（当 categoryId 为空时按名称匹配/创建）
  autoCategoryName: z
    .string()
    .max(32)
    .optional()
    .describe("AI 推断的类目名称，用于自动分类匹配"),
  // ── 产品优化新增字段 ──
  publishSource: z
    .enum(["ai", "manual"])
    .default("manual")
    .describe("发布来源：ai=AI 智能发布，manual=手动发布"),
  reviewStatus: z
    .enum(["pending", "approved", "rejected"])
    .default("approved")
    .describe("审核状态：管理员直发默认 approved，普通用户发布默认 pending"),
  expiryDate: z
    .string()
    .datetime()
    .nullable()
    .default(null)
    .describe("信息有效期，过期自动下架"),
  contactName: z
    .string()
    .max(64)
    .nullable()
    .default(null)
    .describe("联系人姓名"),
  province: z.string().max(32).nullable().default(null).describe("省份"),
  city: z.string().max(32).nullable().default(null).describe("城市"),
  formData: z
    .record(z.unknown())
    .nullable()
    .default(null)
    .describe("结构化表单 JSON，直接存 DB（消除 Vercel Blob 依赖）"),
  aiRawText: z
    .string()
    .max(4096)
    .nullable()
    .default(null)
    .describe("AI 解析的原始输入文本，便于回溯复检"),
});

/**
 * 自动分类匹配：根据类目名称查找或创建 TicketCategory
 * - 优先按名称匹配已有类目（不区分大小写）
 * - 未匹配到则创建新类目，归属当前用户
 * - 返回 categoryId（匹配/新建失败时返回 null）
 */
async function resolveCategoryIdByName(
  name: string | undefined,
  userId: string
): Promise<string | null> {
  if (!name || !name.trim()) return null;
  const trimmed = name.trim();

  try {
    const categories = await getTicketCategories();
    const matched = categories.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (matched) return matched.id;

    // 未匹配则创建新类目
    const created = await createTicketCategory({
      name: trimmed,
      color: "#6366f1",
      colorKey: "indigo",
      sortOrder: 0,
      userId,
    });
    return created.id;
  } catch (err) {
    console.error("[tickets] 自动分类失败:", err);
    return null;
  }
}

// 批量操作 schema
const batchSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "至少选择一个工单"),
  action: z.enum(["status", "priority", "delete", "review"]),
  value: z.string().optional(), // status / priority / reviewStatus 的新值
  reviewNote: z.string().max(512).optional(), // 审核备注（驳回原因）
});

async function checkAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new ChatbotError("unauthorized:ticket");
  }
  return session;
}

/**
 * 检查用户是否有权操作指定工单
 * - 管理员：可操作所有 public 工单
 * - 普通用户：仅可操作自己创建的 private 工单
 */
async function checkTicketOwnership(ticketId: string, userId: string) {
  const existing = await getTicketById({ id: ticketId });
  if (!existing) {
    throw new ChatbotError("not_found:ticket");
  }

  const session = await auth();
  if (session?.user && isAdmin(session.user)) {
    return existing;
  }

  if (existing.userId !== userId || existing.visibility !== "private") {
    throw new ChatbotError("forbidden:ticket");
  }

  return existing;
}

/** CSV 转义 */
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: Request) {
  try {
    const session = await checkAuth();
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope"); // "mine" | "review" | "all"
    const exportCsv = searchParams.get("export");
    const publishSource = searchParams.get("publishSource"); // "ai" | "manual"
    const reviewStatus = searchParams.get("reviewStatus"); // "pending" | "approved" | "rejected"
    const stats = searchParams.get("stats");

    // 🆕 统计概览（管理员仪表盘）
    if (stats === "1") {
      if (!isAdmin(session.user)) {
        return new ChatbotError("forbidden:ticket").toResponse();
      }
      const result = await getTicketPublishStats();
      return Response.json(result, { status: 200 });
    }

    let tickets;
    if (scope === "mine") {
      // 我的发布：当前用户创建的工单（含所有审核状态）
      tickets = await getTicketsByUserId({ userId: session.user.id });
    } else if (scope === "review") {
      // 审核队列：仅管理员可访问，返回待审核工单
      if (!isAdmin(session.user)) {
        return new ChatbotError("forbidden:ticket").toResponse();
      }
      tickets = await getPendingReviewTickets();
    } else if (scope === "unpublished") {
      // 🆕 已启动但未发布：仅管理员可访问，用于通知横幅
      // 返回 isActive=true 且 (visibility=private 或 reviewStatus=pending) 的工单
      if (!isAdmin(session.user)) {
        return new ChatbotError("forbidden:ticket").toResponse();
      }
      tickets = await getUnpublishedActiveTickets();
    } else if (isAdmin(session.user)) {
      tickets = await getTickets();
    } else {
      tickets = await getVisibleTickets({
        userId: session.user.id,
        userIsAdmin: false,
      });
    }

    // 🆕 内存过滤：发布来源 / 审核状态
    if (publishSource === "ai" || publishSource === "manual") {
      tickets = tickets.filter((t) => t.publishSource === publishSource);
    }
    if (
      reviewStatus === "pending" ||
      reviewStatus === "approved" ||
      reviewStatus === "rejected"
    ) {
      tickets = tickets.filter((t) => t.reviewStatus === reviewStatus);
    }

    // CSV 导出
    if (exportCsv === "csv") {
      const header = [
        "ID",
        "标题",
        "描述",
        "优先级",
        "状态",
        "进度",
        "负责人",
        "手机号",
        "截止日期",
        "可见性",
        "启用",
        "创建时间",
        "更新时间",
      ];
      const rows = tickets.map((t) =>
        [
          t.id,
          t.title,
          t.description,
          t.priority,
          t.status,
          t.progress,
          t.assignee ?? "",
          t.phone ?? "",
          t.dueDate ? new Date(t.dueDate).toISOString() : "",
          t.visibility,
          t.isActive ? "是" : "否",
          new Date(t.createdAt).toISOString(),
          new Date(t.updatedAt).toISOString(),
        ]
          .map(csvEscape)
          .join(",")
      );
      const csv = [header.map(csvEscape).join(","), ...rows].join("\n");
      // 🆕 添加 UTF-8 BOM 头，确保 Excel 正确识别中文编码，避免乱码
      const csvWithBom = `\uFEFF${csv}`;
      return new Response(csvWithBom, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="tickets-${Date.now()}.csv"`,
        },
      });
    }

    return Response.json(tickets, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:ticket").toResponse();
  }
}

export async function POST(request: Request) {
  try {
    const session = await checkAuth();
    let body: z.infer<typeof ticketSchema>;

    try {
      body = ticketSchema.parse(await request.json());
    } catch {
      return new ChatbotError(
        "bad_request:ticket",
        "请求数据格式不正确。请检查后重试。"
      ).toResponse();
    }

    // 权限校验：普通用户只能创建 private 工单
    const userIsAdmin = isAdmin(session.user);
    const visibility = userIsAdmin ? body.visibility : "private";

    // 🆕 审核状态：管理员直发默认 approved；普通用户发布默认 pending（待审核）
    const reviewStatus = userIsAdmin ? body.reviewStatus : "pending";

    // 🆕 自动分类匹配：若未显式指定 categoryId，则按 AI 推断的类目名称匹配/创建
    let resolvedCategoryId = body.categoryId;
    if (!resolvedCategoryId && body.autoCategoryName) {
      resolvedCategoryId = await resolveCategoryIdByName(
        body.autoCategoryName,
        session.user.id,
      );
    }

    // 🆕 将 formSchemaUrl 与原始 content 合并写入 content 字段（向后兼容）
    // 新数据优先存 formData（直存 DB），formSchemaUrl 仅作为 Blob 备份
    let finalContent = body.content;
    if (body.formSchemaUrl) {
      const meta = {
        formSchemaUrl: body.formSchemaUrl,
        autoCategoryName: body.autoCategoryName ?? null,
        content: body.content ?? "",
      };
      const metaStr = JSON.stringify(meta);
      // 若元信息超长则降级为仅存 URL
      finalContent = metaStr.length <= 4096 ? metaStr : body.formSchemaUrl;
    }

    const result = await createTicket({
      title: body.title,
      description: body.description,
      content: finalContent,
      priority: body.priority,
      status: body.status,
      progress: body.progress,
      assignee: body.assignee,
      phone: body.phone,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      categoryId: resolvedCategoryId,
      userId: session.user.id,
      visibility,
      isActive: body.isActive,
      sortOrder: body.sortOrder,
      // 🆕 产品优化字段
      publishSource: body.publishSource,
      reviewStatus,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      contactName: body.contactName,
      province: body.province,
      city: body.city,
      formData: body.formData,
      aiRawText: body.aiRawText,
    });

    // 记录创建活动日志
    await logTicketActivity({
      ticketId: result.id,
      userId: session.user.id,
      type: "created",
      summary: "创建了工单",
      newValue: result.title,
    });

    return Response.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:ticket").toResponse();
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await checkAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return new ChatbotError("bad_request:ticket", "缺少参数 id").toResponse();
    }

    let body: z.infer<typeof ticketSchema>;
    try {
      body = ticketSchema.parse(await request.json());
    } catch {
      return new ChatbotError(
        "bad_request:ticket",
        "请求数据格式不正确。请检查后重试。"
      ).toResponse();
    }

    const existing = await checkTicketOwnership(id, session.user.id);

    // 状态机校验：检查状态流转是否合法
    if (
      existing.status !== body.status &&
      !isValidStatusTransition(existing.status, body.status)
    ) {
      return new ChatbotError(
        "bad_request:ticket",
        `状态不能从「${existing.status}」直接变更为「${body.status}」`
      ).toResponse();
    }

    // 普通用户不能将 private 工单改为 public
    const userIsAdmin = isAdmin(session.user);
    const visibility = userIsAdmin ? body.visibility : existing.visibility;

    // 🆕 字段权限收敛：
    // 普通用户只能修改内容性字段（title/description/content/contact 等），
    // 不能修改 status/priority/progress/assignee/sortOrder/isActive 等
    // 流程性字段，避免绕过管理员审核流程。管理员可修改全部字段。
    let patchStatus = body.status;
    let patchPriority = body.priority;
    let patchProgress = body.progress;
    let patchAssignee = body.assignee;
    let patchSortOrder = body.sortOrder;
    let patchIsActive = body.isActive;
    if (!userIsAdmin) {
      patchStatus = existing.status;
      patchPriority = existing.priority;
      patchProgress = existing.progress;
      patchAssignee = existing.assignee;
      patchSortOrder = existing.sortOrder;
      patchIsActive = existing.isActive;
    }

    // 🆕 编辑后重置审核状态：
    // 当工单已被审核（approved/rejected）后，内容发生变更需重新审核。
    // 仅当关键字段（title/description/content）变化时才重置，
    // 避免无关字段（如 phone）微调也触发重审。
    let patchReviewStatus = existing.reviewStatus;
    let patchReviewedById = existing.reviewedById;
    let patchReviewedAt = existing.reviewedAt;
    let patchReviewNote = existing.reviewNote;
    const contentChanged =
      existing.title !== body.title ||
      existing.description !== body.description ||
      existing.content !== body.content;
    if (
      contentChanged &&
      (existing.reviewStatus === "approved" ||
        existing.reviewStatus === "rejected") &&
      !userIsAdmin
    ) {
      patchReviewStatus = "pending";
      patchReviewedById = null;
      patchReviewedAt = null;
      patchReviewNote = null;
    }

    const result = await updateTicket({
      id,
      title: body.title,
      description: body.description,
      content: body.content,
      priority: patchPriority,
      status: patchStatus,
      progress: patchProgress,
      assignee: patchAssignee,
      phone: body.phone,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      categoryId: body.categoryId,
      visibility,
      isActive: patchIsActive,
      sortOrder: patchSortOrder,
      // 🆕 产品优化字段
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      contactName: body.contactName,
      province: body.province,
      city: body.city,
      formData: body.formData,
      // 🆕 重置审核状态
      reviewStatus: patchReviewStatus,
      reviewedById: patchReviewedById,
      reviewedAt: patchReviewedAt,
      reviewNote: patchReviewNote,
    });

    invalidateTicketCache(id);

    // 🆕 记录审核状态重置活动日志
    if (patchReviewStatus !== existing.reviewStatus) {
      await logTicketActivity({
        ticketId: id,
        userId: session.user.id,
        type: "updated",
        summary: `内容变更，审核状态重置：${existing.reviewStatus} → pending`,
        oldValue: existing.reviewStatus,
        newValue: "pending",
      });
    }

    // 记录字段变更活动日志
    if (existing.status !== patchStatus) {
      await logTicketActivity({
        ticketId: id,
        userId: session.user.id,
        type: "status_changed",
        summary: `状态变更: ${existing.status} → ${patchStatus}`,
        oldValue: existing.status,
        newValue: patchStatus,
      });
    }
    if (existing.priority !== patchPriority) {
      await logTicketActivity({
        ticketId: id,
        userId: session.user.id,
        type: "priority_changed",
        summary: `优先级变更: ${existing.priority} → ${patchPriority}`,
        oldValue: existing.priority,
        newValue: patchPriority,
      });
    }
    if (existing.assignee !== patchAssignee) {
      await logTicketActivity({
        ticketId: id,
        userId: session.user.id,
        type: "assignee_changed",
        summary: `负责人变更: ${existing.assignee ?? "无"} → ${patchAssignee ?? "无"}`,
        oldValue: existing.assignee ?? "",
        newValue: patchAssignee ?? "",
      });
    }

    return Response.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:ticket").toResponse();
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await checkAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const batch = searchParams.get("batch");

    // 批量删除
    if (batch === "1") {
      if (!isAdmin(session.user)) {
        return new ChatbotError("forbidden:ticket").toResponse();
      }
      let body: z.infer<typeof batchSchema>;
      try {
        body = batchSchema.parse(await request.json());
      } catch {
        return new ChatbotError(
          "bad_request:ticket",
          "批量操作请求数据格式不正确。"
        ).toResponse();
      }
      if (body.action !== "delete") {
        return new ChatbotError(
          "bad_request:ticket",
          "批量删除操作类型错误。"
        ).toResponse();
      }
      const results = await batchDeleteTickets({ ids: body.ids });
      for (const tid of body.ids) invalidateTicketCache(tid);
      return Response.json({ deleted: results.length }, { status: 200 });
    }

    if (!id) {
      return new ChatbotError("bad_request:ticket", "缺少参数 id").toResponse();
    }

    await checkTicketOwnership(id, session.user.id);

    // 记录删除活动日志（在删除前记录）
    await logTicketActivity({
      ticketId: id,
      userId: session.user.id,
      type: "deleted",
      summary: "删除了工单",
    });

    const result = await deleteTicket({ id });
    invalidateTicketCache(id);
    return Response.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:ticket").toResponse();
  }
}

/** 批量更新（PUT 方法用于批量状态/优先级变更） */
export async function PUT(request: Request) {
  try {
    const session = await checkAuth();
    if (!isAdmin(session.user)) {
      return new ChatbotError("forbidden:ticket").toResponse();
    }

    let body: z.infer<typeof batchSchema>;
    try {
      body = batchSchema.parse(await request.json());
    } catch {
      return new ChatbotError(
        "bad_request:ticket",
        "批量操作请求数据格式不正确。"
      ).toResponse();
    }

    let results;
    if (body.action === "status" && body.value) {
      const targetStatus = body.value as
        | "pending"
        | "in_progress"
        | "completed"
        | "closed";

      // 🆕 批量状态机校验：逐个检查流转合法性，拒绝非法跳转
      // 收集合法的 ID，跳过非法的，保证部分成功而非整体失败
      const validIds: string[] = [];
      for (const tid of body.ids) {
        const t = await getTicketById({ id: tid });
        if (t && isValidStatusTransition(t.status, targetStatus)) {
          validIds.push(tid);
        }
      }
      if (validIds.length === 0) {
        return new ChatbotError(
          "bad_request:ticket",
          "所选工单均不满足状态流转条件。"
        ).toResponse();
      }
      results = await batchUpdateTicketStatus({
        ids: validIds,
        status: targetStatus,
      });

      // 🆕 批量状态变更活动日志
      for (const tid of validIds) {
        await logTicketActivity({
          ticketId: tid,
          userId: session.user.id,
          type: "status_changed",
          summary: `批量状态变更 → ${targetStatus}`,
          oldValue: null,
          newValue: targetStatus,
        });
      }
    } else if (body.action === "priority" && body.value) {
      const targetPriority = body.value as
        | "low"
        | "medium"
        | "high"
        | "urgent";
      results = await batchUpdateTicketPriority({
        ids: body.ids,
        priority: targetPriority,
      });

      // 🆕 批量优先级变更活动日志
      for (const tid of body.ids) {
        await logTicketActivity({
          ticketId: tid,
          userId: session.user.id,
          type: "priority_changed",
          summary: `批量优先级变更 → ${targetPriority}`,
          oldValue: null,
          newValue: targetPriority,
        });
      }
    } else if (body.action === "review" && body.value) {
      // 🆕 批量审核：approve / reject
      const reviewStatus = body.value as "approved" | "rejected";

      // 🆕 批量审核状态机校验：仅 pending 工单可审核
      const validIds: string[] = [];
      for (const tid of body.ids) {
        const t = await getTicketById({ id: tid });
        if (t && t.reviewStatus === "pending") {
          validIds.push(tid);
        }
      }
      if (validIds.length === 0) {
        return new ChatbotError(
          "bad_request:ticket",
          "所选工单均不在待审核状态。"
        ).toResponse();
      }
      results = await batchReviewTickets({
        ids: validIds,
        reviewStatus,
        reviewedById: session.user.id,
        reviewNote: body.reviewNote ?? null,
      });
      for (const tid of validIds) {
        invalidateTicketCache(tid);
        await logTicketActivity({
          ticketId: tid,
          userId: session.user.id,
          type: "reviewed",
          summary: `批量审核：pending → ${reviewStatus}${
            body.reviewNote ? `（${body.reviewNote}）` : ""
          }`,
          oldValue: "pending",
          newValue: reviewStatus,
        });
      }
    } else {
      return new ChatbotError(
        "bad_request:ticket",
        "批量操作参数不完整。"
      ).toResponse();
    }

    for (const tid of body.ids) invalidateTicketCache(tid);
    return Response.json({ updated: results.length }, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:ticket").toResponse();
  }
}
