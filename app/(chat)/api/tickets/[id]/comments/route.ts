import { auth } from "@/app/(auth)/auth";
import {
  createTicketComment,
  getTicketById,
  getTicketComments,
  logTicketActivity,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import { isAdmin } from "@/lib/utils";

const commentSchema = {
  validate(body: unknown): { content: string } | null {
    if (
      typeof body === "object" &&
      body !== null &&
      "content" in body &&
      typeof (body as { content: unknown }).content === "string"
    ) {
      const content = (body as { content: string }).content.trim();
      if (content.length === 0 || content.length > 2000) return null;
      return { content };
    }
    return null;
  },
};

/**
 * 校验当前用户是否有权访问指定工单的评论：
 * - 管理员：可访问所有工单
 * - 普通用户：仅可访问 public 工单，或自己创建的 private 工单
 *
 * 此前任何登录用户都能通过 ID 读取/评论任意工单（含他人 private 工单），
 * 存在数据泄露风险。此函数统一收敛评论接口的可见性边界。
 */
async function assertTicketVisible(
  ticketId: string,
  userId: string,
  userIsAdmin: boolean
) {
  const ticket = await getTicketById({ id: ticketId });
  if (!ticket) {
    throw new ChatbotError("not_found:ticket");
  }

  if (userIsAdmin) {
    return ticket;
  }

  const isOwner = ticket.userId === userId;
  const isPublic = ticket.visibility === "public";
  if (!isPublic && !isOwner) {
    throw new ChatbotError("forbidden:ticket");
  }
  return ticket;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new ChatbotError("unauthorized:ticket");
    }
    const { id } = await params;
    await assertTicketVisible(id, session.user.id, isAdmin(session.user));
    const comments = await getTicketComments({ ticketId: id });
    return Response.json(comments, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:ticket").toResponse();
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new ChatbotError("unauthorized:ticket");
    }
    const { id } = await params;
    await assertTicketVisible(id, session.user.id, isAdmin(session.user));
    const parsed = commentSchema.validate(await request.json());
    if (!parsed) {
      return new ChatbotError(
        "bad_request:ticket",
        "评论内容不能为空且不超过 2000 字。"
      ).toResponse();
    }
    const result = await createTicketComment({
      ticketId: id,
      userId: session.user.id,
      content: parsed.content,
    });

    // 记录评论活动日志，补全审计追踪
    await logTicketActivity({
      ticketId: id,
      userId: session.user.id,
      type: "commented",
      summary: `发表评论：${parsed.content.slice(0, 50)}${parsed.content.length > 50 ? "…" : ""}`,
    });

    return Response.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:ticket").toResponse();
  }
}
