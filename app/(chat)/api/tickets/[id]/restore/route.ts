import { auth } from "@/app/(auth)/auth";
import {
  getTicketById,
  invalidateTicketCache,
  restoreTicket,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import { isAdmin } from "@/lib/utils";

// POST /api/tickets/[id]/restore
// 管理员恢复软删除的工单
export async function POST(
  _request: Request,
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
    const existing = await getTicketById({ id });
    // 软删除的工单 getTicketById 查不到，这里直接尝试恢复
    if (!existing) {
      // 仍尝试恢复（可能是软删除状态）
    }

    const result = await restoreTicket({ id });
    if (!result) {
      return new ChatbotError("not_found:ticket").toResponse();
    }
    invalidateTicketCache(id);
    return Response.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    console.error("[tickets/restore] error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
