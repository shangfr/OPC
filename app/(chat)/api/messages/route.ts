import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  getChatById,
  getChatWithAgent,
  getMessagesByChatId,
  saveMessages,
} from "@/lib/db/queries";
import { convertToUIMessages } from "@/lib/utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");

  if (!chatId) {
    return Response.json({ error: "chatId required" }, { status: 400 });
  }

  const [session, chat, messages] = await Promise.all([
    auth(),
    getChatWithAgent({ id: chatId }),
    getMessagesByChatId({ id: chatId }),
  ]);

  if (!chat) {
    return Response.json({
      messages: [],
      visibility: "private",
      userId: null,
      isReadonly: false,
    });
  }

  if (
    chat.visibility === "private" &&
    (!session?.user || session.user.id !== chat.userId)
  ) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const isReadonly = !session?.user || session.user.id !== chat.userId;

  return Response.json({
    messages: convertToUIMessages(messages),
    title: chat.title,
    visibility: chat.visibility,
    userId: chat.userId,
    agentId: chat.agentId,
    agentName: chat.agentName,
    isReadonly,
  });
}

export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");

  if (!chatId) {
    return Response.json({ error: "chatId required" }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const chat = await getChatById({ id: chatId });
  if (!chat || chat.userId !== session.user.id) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { messageId, parts, role } = z
    .object({
      messageId: z.string(),
      parts: z.any(),
      role: z.string().default("assistant"),
    })
    .parse(body);

  await saveMessages({
    messages: [
      {
        id: messageId,
        chatId,
        role,
        parts,
        createdAt: new Date(),
        attachments: [],
      },
    ],
  });

  return Response.json({ success: true });
}
