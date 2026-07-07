import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  deleteAllChatsByUserId,
  deleteChatsByIds,
  getChatsByUserId,
  getPinnedChatsByUserId,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const limit = Math.min(
    Math.max(Number.parseInt(searchParams.get("limit") || "10", 10), 1),
    100
  );
  const startingAfter = searchParams.get("starting_after");
  const endingBefore = searchParams.get("ending_before");
  const pinned = searchParams.get("pinned");

  if (startingAfter && endingBefore) {
    return new ChatbotError(
      "bad_request:api",
      "Only one of starting_after or ending_before can be provided."
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  // 置顶对话列表（用于「我的置顶」页面）
  if (pinned) {
    const pinnedChats = await getPinnedChatsByUserId({ id: session.user.id });
    return Response.json({ chats: pinnedChats });
  }

  const chats = await getChatsByUserId({
    id: session.user.id,
    limit,
    startingAfter,
    endingBefore,
    // SaaS 多租户：仅返回当前团队的对话，实现租户隔离
    teamId: session.user.teamId ?? null,
  });

  return Response.json(chats);
}

export async function DELETE(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids");

  if (idsParam) {
    const ids = idsParam.split(",").filter(Boolean);

    if (ids.length === 0) {
      return new ChatbotError("bad_request:api").toResponse();
    }

    const result = await deleteChatsByIds({
      ids,
      userId: session.user.id,
    });

    return Response.json(result, { status: 200 });
  }

  const result = await deleteAllChatsByUserId({ userId: session.user.id });

  return Response.json(result, { status: 200 });
}
