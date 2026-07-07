import { auth } from "@/app/(auth)/auth";
import {
  getTicketById,
  invalidateTicketCache,
  logTicketActivity,
  updateTicket,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import { isAdmin } from "@/lib/utils";

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new ChatbotError("unauthorized:ticket");
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return new ChatbotError("bad_request:ticket", "缺少参数 id").toResponse();
    }

    // 1. 查询当前工单状态
    const existing = await getTicketById({ id });
    if (!existing) {
      throw new ChatbotError("not_found:ticket");
    }

    // 2. 权限校验：
    //    - 管理员可以操作所有工单
    //    - 普通用户只能操作自己创建的工单（无论 public/private）
    //      此前仅允许 private 工单的 owner 切换，导致用户在工单被
    //      审核通过（变 public）后无法自行下架，体验割裂。现统一为
    //      「自己的工单可启停」，但 public 工单停用后仍对他人不可见。
    const userIsAdmin = isAdmin(session.user);
    if (!userIsAdmin) {
      if (existing.userId !== session.user.id) {
        throw new ChatbotError("forbidden:ticket");
      }
    }

    const nextActive = !existing.isActive;

    // 3. 执行状态取反更新
    const result = await updateTicket({
      id,
      isActive: nextActive,
      // 为了防止 updateTicket 底层把其他字段覆盖为空，把现有的主要字段带上
      title: existing.title,
      description: existing.description,
      content: existing.content,
      priority: existing.priority,
      status: existing.status,
      progress: existing.progress,
      assignee: existing.assignee,
      phone: existing.phone,
      dueDate: existing.dueDate,
      categoryId: existing.categoryId,
      visibility: existing.visibility,
      sortOrder: existing.sortOrder,
      expiryDate: existing.expiryDate,
      contactName: existing.contactName,
      province: existing.province,
      city: existing.city,
      formData: (existing.formData as Record<string, unknown> | null) ?? null,
    });

    // 4. 清除缓存
    invalidateTicketCache(id);

    // 5. 记录启停活动日志，补全审计追踪
    await logTicketActivity({
      ticketId: id,
      userId: session.user.id,
      type: "updated",
      summary: `${nextActive ? "启用" : "停用"}工单`,
      oldValue: String(existing.isActive),
      newValue: String(nextActive),
    });

    return Response.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:ticket").toResponse();
  }
}
