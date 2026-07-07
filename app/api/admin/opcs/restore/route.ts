import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { restoreOpc } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

/**
 * 管理员恢复已下架的 OPC（重新上架）。
 * 仅 admin 角色可调用。将 delisted 状态恢复为 listed。
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

    const { agentId } = (await req.json()) as { agentId: string };
    if (!agentId) {
      return new ChatbotError("bad_request:api", "缺少 agentId").toResponse();
    }

    await restoreOpc({
      agentId,
      reviewerId: session.user.id,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ChatbotError) return error.toResponse();
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}
