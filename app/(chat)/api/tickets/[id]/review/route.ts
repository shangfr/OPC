import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  getTicketById,
  invalidateTicketCache,
  logTicketActivity,
  reviewTicket,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import { isValidReviewTransition } from "@/lib/ticket-status-machine";
import { isAdmin } from "@/lib/utils";

const reviewSchema = z.object({
  reviewStatus: z.enum(["approved", "rejected"]),
  reviewNote: z.string().max(512).optional().default(""),
});

// POST /api/tickets/[id]/review
// 管理员审核单个工单：通过 / 驳回（含驳回原因）
//
// 状态机约束：
// - pending → approved / rejected（首次审核，合法）
// - approved / rejected → 不可直接再次审核（需先撤回到 pending）
// 这样可避免重复审核已决策的工单，保证审核流程的确定性。
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
    const body = await request.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return new ChatbotError(
        "bad_request:ticket",
        "审核参数不正确：" + parsed.error.message,
      ).toResponse();
    }

    const existing = await getTicketById({ id });
    if (!existing) {
      return new ChatbotError("not_found:ticket").toResponse();
    }

    // 🆕 审核状态机校验：仅 pending 工单可执行审核动作
    if (!isValidReviewTransition(existing.reviewStatus, parsed.data.reviewStatus)) {
      return new ChatbotError(
        "bad_request:ticket",
        `当前审核状态为「${existing.reviewStatus}」，不可直接变更为「${parsed.data.reviewStatus}」。请先撤回到待审核状态。`,
      ).toResponse();
    }

    const result = await reviewTicket({
      id,
      reviewStatus: parsed.data.reviewStatus,
      reviewedById: session.user.id,
      reviewNote: parsed.data.reviewNote || null,
    });

    invalidateTicketCache(id);
    await logTicketActivity({
      ticketId: id,
      userId: session.user.id,
      type: "reviewed",
      summary: `审核状态：${existing.reviewStatus} → ${parsed.data.reviewStatus}${
        parsed.data.reviewNote ? `（${parsed.data.reviewNote}）` : ""
      }`,
      oldValue: existing.reviewStatus,
      newValue: parsed.data.reviewStatus,
    });

    return Response.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    console.error("[tickets/review] error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
