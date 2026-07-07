import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  getTicketById,
  invalidateTicketCache,
  logTicketActivity,
  publishTicket,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import { isAdmin } from "@/lib/utils";

const publishSchema = z.object({
  reviewNote: z.string().max(512).optional().default(""),
});

// POST /api/tickets/[id]/publish
// 管理员一键发布工单到市场：
// 将已启动（isActive）但未发布（visibility=private 或 reviewStatus=pending）
// 的工单发布到「发现市场」，使其对所有用户可见。
//
// 与 /review (approved) 的区别：
//   - review 更侧重「审核通过/驳回」语义，适用于 pending 工单的审核流程；
//   - publish 更侧重「发布到市场」语义，适用于已启动但未公开的工单。
// 两者最终效果一致（visibility=public + reviewStatus=approved + isActive=true）。
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new ChatbotError("unauthorized:ticket").toResponse();
    }
    if (!isAdmin(session.user)) {
      return new ChatbotError("forbidden:ticket").toResponse();
    }

    const { id } = await params;
    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      // 允许无 body 调用
    }
    const parsed = publishSchema.safeParse(body);
    if (!parsed.success) {
      return new ChatbotError(
        "bad_request:ticket",
        "发布参数不正确：" + parsed.error.message,
      ).toResponse();
    }

    const existing = await getTicketById({ id });
    if (!existing) {
      return new ChatbotError("not_found:ticket").toResponse();
    }

    const result = await publishTicket({
      id,
      reviewedById: session.user.id,
      reviewNote: parsed.data.reviewNote || null,
    });

    invalidateTicketCache(id);
    await logTicketActivity({
      ticketId: id,
      userId: session.user.id,
      type: "updated",
      summary: `发布到市场：${existing.visibility}/${existing.reviewStatus} → public/approved`,
      oldValue: `${existing.visibility}/${existing.reviewStatus}`,
      newValue: "public/approved",
    });

    return Response.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    console.error("[tickets/publish] error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
