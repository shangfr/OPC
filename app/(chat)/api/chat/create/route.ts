import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { getAgentById, getDefaultAgent } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import { generateUUID } from "@/lib/utils";

const createChatSchema = z.object({
  agentId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  let body: z.infer<typeof createChatSchema>;
  try {
    body = createChatSchema.parse(await request.json());
  } catch {
    return new ChatbotError("bad_request:api", "请求参数不正确").toResponse();
  }

  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  // If no agentId is specified, use the default agent if one exists
  let resolvedAgentId = body.agentId ?? null;
  let resolvedAgentName: string | null = null;
  if (resolvedAgentId) {
    const agentRecord = await getAgentById({ id: resolvedAgentId });
    resolvedAgentName = agentRecord?.name ?? null;
  } else {
    const defaultAgent = await getDefaultAgent();
    if (defaultAgent) {
      resolvedAgentId = defaultAgent.id;
      resolvedAgentName = defaultAgent.name;
    }
  }

  // Only generate chatId, don't save to DB yet.
  // DB record is created when the first message is sent.
  const chatId = generateUUID();

  return Response.json({
    chatId,
    agentId: resolvedAgentId,
    agentName: resolvedAgentName,
  });
}
