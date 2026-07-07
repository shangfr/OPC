import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { forceDelistOpc } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

/**
 * 管理员强制下架 OPC（风控）。
 * 仅 admin 角色可调用。记录下架原因与操作人，便于审计与恢复。
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new ChatbotError("unauthorized:api").toResponse();
    }
    if (session.user.role !== "admin") {
      return new ChatbotError("forbidden:api", "需要管理员权限").toResponse();
    }

    const { agentId, reason } = (await req.json()) as {
      agentId: string;
      reason?: string;
    };
    if (!agentId) {
      return new ChatbotError("bad_request:api", "缺少 agentId").toResponse();
    }

    await forceDelistOpc({
      agentId,
      reviewerId: session.user.id,
      reason: reason?.trim() || undefined,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ChatbotError) return error.toResponse();
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}
