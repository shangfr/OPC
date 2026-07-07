import { auth } from "@/app/(auth)/auth";
import { getTicketById, incrementTicketViewCount } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

// POST /api/tickets/[id]/view
// 浏览量自增：用户打开供需详情时调用，用于热度排序
// 无需鉴权（公开可见的工单任何人可浏览），但记录访问
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new ChatbotError("unauthorized:ticket").toResponse();
    }

    const { id } = await params;
    const existing = await getTicketById({ id });
    if (!existing) {
      return new ChatbotError("not_found:ticket").toResponse();
    }

    const result = await incrementTicketViewCount({ id });
    return Response.json(
      { viewCount: result?.viewCount ?? 0 },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    console.error("[tickets/view] error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
