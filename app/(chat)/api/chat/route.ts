// app/(chat)/api/chat/route.ts
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  stepCountIs,
  streamText,
} from "ai";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { auth } from "@/app/(auth)/auth";
import { getMaxMessagesPerHour } from "@/lib/ai/entitlements";
import {
  allowedModelIds,
  chatModels,
  DEFAULT_CHAT_MODEL,
  getCapabilities,
} from "@/lib/ai/models";
import { infrastructurePrompt, type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { withRetry } from "@/lib/ai/retry";
import { retrieve as retrieveKnowledge } from "@/lib/ai/zhipu-knowledge";
import { createDocument } from "@/lib/ai/tools/create-document";
import { editDocument } from "@/lib/ai/tools/edit-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { webSearch } from "@/lib/ai/tools/web-search";
import { codeInterpreter } from "@/lib/ai/tools/code-interpreter";
import { generateImage } from "@/lib/ai/tools/generate-image";
import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getAgentById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  getSiteConfig,
  saveChat,
  saveMessages,
  updateChatPinnedById,
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import {
  checkMessageQuota,
  incrementMessageUsage,
} from "@/lib/quotas/usage";
import type { ChatMessage } from "@/lib/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";
import { handleSummarizeTask } from "@/lib/ai/summarize-task";

export const maxDuration = 60;

const MAX_CONTEXT_MESSAGES = 40;

function geolocation(request: Request) {
  const h = request.headers;
  return {
    latitude: h.get("cf-iplatitude") ?? h.get("x-vercel-ip-latitude") ?? undefined,
    longitude: h.get("cf-iplongitude") ?? h.get("x-vercel-ip-longitude") ?? undefined,
    city: h.get("cf-ipcity") ?? h.get("x-vercel-ip-city") ?? undefined,
    country: h.get("cf-ipcountry") ?? h.get("x-vercel-ip-country") ?? undefined,
  };
}

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch (error) {
    // 非生产环境（如本地开发或非 Vercel 部署）下 resumable-stream 可能不可用，静默降级
    if (isProductionEnvironment) {
      console.warn(
        "[chat] getStreamContext 初始化失败:",
        error instanceof Error ? error.message : error,
      );
    }
    return null;
  }
}

export { getStreamContext };

export async function POST(request: Request) {
  let requestBody: PostRequestBody;
  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  try {
    const {
      id,
      message,
      messages,
      selectedChatModel,
      selectedVisibilityType,
      agentId,
      thinkingEnabled,
      isNewChat,
      summarizeTask, // 🚨 解构汇总标识
    } = requestBody;

    const [session, chat, agentRecord] = await Promise.all([
      auth(),
      isNewChat ? Promise.resolve(null) : getChatById({ id }),
      agentId ? getAgentById({ id: agentId }) : Promise.resolve(null),
    ]);

    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    const chatModel = allowedModelIds.has(selectedChatModel)
      ? selectedChatModel
      : DEFAULT_CHAT_MODEL;

    const userPlan = session.user.planName ?? "free";
    const isAdmin = session.user.role === "admin";
    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 1,
    });

    // 套餐驱动型限流：按套餐设置小时级消息上限
    const maxPerHour = getMaxMessagesPerHour(userPlan, isAdmin);
    if (messageCount > maxPerHour) {
      return new ChatbotError("rate_limit:chat").toResponse();
    }

    // SaaS 多租户：团队本月消息配额检查
    // 超限时返回 rate_limit:quota 错误，前端引导去 /pricing 升级
    try {
      await checkMessageQuota(session.user.teamId ?? null);
    } catch (error) {
      if (error instanceof ChatbotError) {
        return error.toResponse();
      }
      throw error;
    }

    // ==========================================
    // 🚨 核心分支：置顶对话汇总任务（逻辑已抽取到 lib/ai/summarize-task.ts）
    // ==========================================
    if (summarizeTask) {
      return handleSummarizeTask({
        chatId: id,
        userMessage: message,
        selectedVisibilityType,
        agentId,
        agentRecord: agentRecord as any,
        chatModel,
        session,
        summarizeTask,
      });
    }

    // ==========================================
    // 汇总分支结束，以下是原有正常聊天逻辑
    // ==========================================

    const isToolApprovalFlow = Boolean(messages);
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatbotError("forbidden:chat").toResponse();
      }
      messagesFromDb = await getMessagesByChatId({ id });
    } else if (message?.role === "user") {
      await saveChat({
        id,
        userId: session.user.id,
        title: "New chat",
        visibility: selectedVisibilityType,
        agentId: agentId,
        agentName: agentRecord?.name ?? null,
        // SaaS 多租户：归属当前团队
        teamId: session.user.teamId ?? null,
      });
      titlePromise = generateTitleFromUserMessage({ message });
    }

    let uiMessages: ChatMessage[];
    if (isToolApprovalFlow && messages) {
      const dbMessages = convertToUIMessages(messagesFromDb);
      const approvalStates = new Map(
        messages.flatMap(
          (m) =>
            m.parts
              ?.filter(
                (p: Record<string, unknown>) =>
                  p.state === "approval-responded" ||
                  p.state === "output-denied"
              )
              .map((p: Record<string, unknown>) => [
                String(p.toolCallId ?? ""),
                p,
              ]) ?? []
        )
      );
      uiMessages = dbMessages.map((msg) => ({
        ...msg,
        parts: msg.parts.map((part) => {
          if ("toolCallId" in part && approvalStates.has(String(part.toolCallId))) {
            return { ...part, ...approvalStates.get(String(part.toolCallId)) };
          }
          return part;
        }),
      })) as ChatMessage[];
    } else {
      uiMessages = [...convertToUIMessages(messagesFromDb), message as ChatMessage];
    }

    const { longitude, latitude, city, country } = geolocation(request);
    const requestHints: RequestHints = { longitude, latitude, city, country };
    const modelConfig = chatModels.find((m) => m.id === chatModel);
    const capabilities = getCapabilities()[chatModel];
    const isReasoningModel = capabilities?.reasoning === true;
    const supportsTools = capabilities?.tools === true;
    let systemMessage = systemPrompt({ requestHints, supportsTools });

    let knowledgeContext = "";
    if (agentRecord?.isActive && agentRecord?.knowledgeId) {
      try {
        const lastUserMsg = uiMessages[uiMessages.length - 1];
        const queryText = lastUserMsg?.parts
          ?.filter((p: { type: string }) => p.type === "text")
          .map((p: { type: string; text?: string }) => (p as { text: string }).text)
          .join(" ") ?? "";
        if (queryText.trim()) {
          const retrieveResult = await retrieveKnowledge({
            query: queryText.slice(0, 1000),
            knowledge_ids: [agentRecord.knowledgeId],
            top_k: 5,
            recall_method: "mixed",
          });
          if (!isProductionEnvironment) {
            console.log("[chat] 知识库检索 query:", queryText.slice(0, 100));
          }
          if (retrieveResult.code === 200 && retrieveResult.data && retrieveResult.data.length > 0) {
            const chunks = retrieveResult.data.map((r) => r.text).join("\n\n");
            knowledgeContext = `\n\n## 知识库参考内容\n以下是从知识库中检索到的相关信息，请优先基于这些内容回答用户问题。\n\n${chunks}`;
          }
        }
      } catch (e) {
        console.warn("[chat] 知识库检索失败:", e instanceof Error ? e.message : e);
      }
    }

    if (agentRecord?.isActive) {
      systemMessage = `${agentRecord.systemPrompt}${knowledgeContext}\n\n${systemMessage}`;
    } else if (!agentId) {
      const config = await getSiteConfig();
      if (config?.defaultSystemPrompt) {
        const infrastructure = infrastructurePrompt({ requestHints, supportsTools });
        systemMessage = `${config.defaultSystemPrompt}\n\n${infrastructure}`;
      }
    }

    let modelMessages = await convertToModelMessages(uiMessages);
    if (modelMessages.length > MAX_CONTEXT_MESSAGES) {
      modelMessages = modelMessages.slice(-MAX_CONTEXT_MESSAGES);
    }

    if (message?.role === "user") {
      saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id,
            role: "user",
            parts: message.parts,
            attachments: [],
            createdAt: new Date(),
          },
        ],
      }).catch((error) => {
        console.error("[chat] 用户消息保存失败:", error instanceof Error ? error.message : error);
      });
    }

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        const result = await withRetry(
          () => streamText({
            model: getLanguageModel(chatModel),
            system: systemMessage,
            messages: modelMessages,
            stopWhen: stepCountIs(5),
            experimental_activeTools: isReasoningModel && !supportsTools ? [] : [
              "getWeather", "createDocument", "editDocument", "updateDocument", "requestSuggestions",
              "webSearch", "codeInterpreter", "generateImage",
            ],
            providerOptions: {
              ...(modelConfig?.reasoningEffort && { openai: { reasoningEffort: modelConfig.reasoningEffort } }),
            },
            tools: {
              getWeather,
              createDocument: createDocument({ session, dataStream, modelId: chatModel, chatId: id}),
              editDocument: editDocument({ dataStream, session}),
              updateDocument: updateDocument({ session, dataStream, modelId: chatModel}),
              requestSuggestions: requestSuggestions({ session, dataStream, modelId: chatModel}),
              webSearch,
              codeInterpreter,
              generateImage,
            },
            experimental_telemetry: { isEnabled: isProductionEnvironment, functionId: "stream-text" },
          }),
          3,
          (attempt, error, delayMs) => {
            console.warn(`[chat] streamText retry ${attempt}:`, error instanceof Error ? error.message : error);
          }
        );

        dataStream.merge(result.toUIMessageStream({ sendReasoning: isReasoningModel && thinkingEnabled }));

        if (titlePromise) {
          try {
            const title = await titlePromise;
            dataStream.write({ type: "data-chat-title", data: title });
            updateChatTitleById({ chatId: id, title });
          } catch (error) {
            console.warn("[chat] 标题生成失败:", error instanceof Error ? error.message : error);
          }
        }
      },
      generateId: generateUUID,
      onFinish: async ({ messages: finishedMessages }) => {
        if (isToolApprovalFlow) {
          for (const finishedMsg of finishedMessages) {
            const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);
            if (existingMsg) {
              await updateMessage({ id: finishedMsg.id, parts: finishedMsg.parts });
            } else {
              await saveMessages({ messages: [{ id: finishedMsg.id, role: finishedMsg.role, parts: finishedMsg.parts, createdAt: new Date(), attachments: [], chatId: id }] });
            }
          }
        } else if (finishedMessages.length > 0) {
          await saveMessages({
            messages: finishedMessages.map((currentMessage) => ({
              id: currentMessage.id, role: currentMessage.role, parts: currentMessage.parts, createdAt: new Date(), attachments: [], chatId: id,
            })),
          });
        }

        // SaaS 多租户：AI 回复成功生成后，累加团队本月已用消息数
        // 放在 onFinish 确保只有成功的回复才计入配额
        await incrementMessageUsage(session.user.teamId ?? null);
      },
      onError: (error) => {
        if (error instanceof Error) {
          const msg = error.message ?? "";
          // 智谱 API 余额不足
          if (msg.includes("Insufficient Balance")) {
            return "AI 服务余额不足，请联系管理员充值。";
          }
          // 智谱 API 限流（429）
          if (msg.includes("429") || msg.includes("Too Many Requests") || msg.includes("rate_limit")) {
            return "当前请求量过大，请稍后重试。";
          }
          // 智谱 API 内容审核拦截
          if (msg.includes("content_filter") || msg.includes("Content Filter") || msg.includes("1301")) {
            return "您的消息包含敏感内容，已被安全系统拦截，请修改后重试。";
          }
          // 模型上下文超限
          if (msg.includes("context_length") || msg.includes("maximum context") || msg.includes("token limit")) {
            return "对话内容过长，请开启新对话或精简消息后重试。";
          }
          // 网络超时
          if (msg.includes("timeout") || msg.includes("ETIMEDOUT")) {
            return "请求超时，请检查网络后重试。";
          }
          console.error("[chat] streamText error:", msg);
        }
        return "AI 服务暂时不可用，请稍后重试。如果问题持续，请联系管理员。";
      },
    });

    return createUIMessageStreamResponse({
      stream,
      async consumeSseStream({ stream: sseStream }) {
        if (!process.env.REDIS_URL) return;
        try {
          const streamContext = getStreamContext();
          if (streamContext) {
            const streamId = generateId();
            await createStreamId({ streamId, chatId: id });
            await streamContext.createNewResumableStream(streamId, () => sseStream);
          }
        } catch (error) {
          console.warn("[chat] 可恢复流持久化失败:", error instanceof Error ? error.message : error);
        }
      },
    });
  } catch (error) {
    const requestId = request.headers.get("x-request-id") ?? generateUUID();
    if (error instanceof ChatbotError) return error.toResponse();
    if (error instanceof Error) {
      const msg = error.message ?? "";
      if (msg.includes("Insufficient Balance")) {
        return Response.json(
          { code: "bad_request:api", message: "AI 服务余额不足，请联系管理员充值。" },
          { status: 400 }
        );
      }
      if (msg.includes("429") || msg.includes("Too Many Requests")) {
        return Response.json(
          { code: "rate_limit:api", message: "当前请求量过大，请稍后重试。" },
          { status: 429 }
        );
      }
    }
    console.error("Unhandled error in chat API:", error, { requestId });
    return new ChatbotError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return new ChatbotError("bad_request:api").toResponse();
  
  const session = await auth();
  if (!session?.user) return new ChatbotError("unauthorized:chat").toResponse();
  
  const chat = await getChatById({ id });
  if (chat?.userId !== session.user.id) return new ChatbotError("forbidden:chat").toResponse();
  
  const deletedChat = await deleteChatById({ id });
  return Response.json(deletedChat, { status: 200 });
}

export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return new ChatbotError("bad_request:api").toResponse();
  
  let body: { pinned?: boolean };
  try {
    body = (await request.json()) as { pinned?: boolean };
  } catch (_) {
    return new ChatbotError("bad_request:api").toResponse();
  }
  
  const session = await auth();
  if (!session?.user) return new ChatbotError("unauthorized:chat").toResponse();
  
  const existingChat = await getChatById({ id });
  if (existingChat?.userId !== session.user.id) return new ChatbotError("forbidden:chat").toResponse();
  
  const pinnedAt = body.pinned ? new Date() : null;
  await updateChatPinnedById({ chatId: id, pinnedAt });
  return Response.json({ id, pinnedAt }, { status: 200 });
}
