import { auth } from "@/app/(auth)/auth";
import { NextResponse } from "next/server";
import { getAgentChatCounts } from "@/lib/db/queries";

/**
 * GET /api/agents/usage
 *
 * 返回所有 Agent 的对话使用数量统计。
 * 响应格式：{ [agentId: string]: number }
 *
 * 用于在 Agent 卡片上展示使用热度 Badge，帮助 OPC 用户识别
 * 哪些 Agent 被频繁使用，从而优化 Agent 配置与资源分配。
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "未登录，无法获取使用统计" },
      { status: 401 },
    );
  }

  try {
    const counts = await getAgentChatCounts();
    return NextResponse.json(counts, {
      status: 200,
      headers: {
        // 缓存 60 秒，减少重复查询；Agent 卡片列表通常不会频繁刷新
        "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "获取使用统计失败" },
      { status: 500 },
    );
  }
}
