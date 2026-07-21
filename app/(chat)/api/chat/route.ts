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
import { sendSms } from "@/lib/ai/tools/send-sms";
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
import { logger } from "@/lib/logger";
import { captureException } from "@/lib/sentry";
import {
  checkMessageQuota,
  incrementMessageUsage,
} from "@/lib/quotas/usage";
import { checkIpRateLimit, getClientIp } from "@/lib/ratelimit";
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
      logger.warn(
        { module: "chat", err: error instanceof Error ? error.message : error },
        "getStreamContext 初始化失败",
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

    // ── IP 限流：未登录用户防恶意刷量（已登录用户由下方小时配额限制）──
    // 必须在 auth() 之前执行，避免未登录请求消耗数据库连接
    const clientIp = getClientIp(request);
    await checkIpRateLimit(clientIp);

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

    // 并行执行：小时限流查询 + 团队配额检查
    // 这两个操作互不依赖，串行会浪费 5-10ms
    // 注意：历史消息拉取不能在这里并行，因为 summarizeTask 分支不需要它
    const isToolApprovalFlow = Boolean(messages);
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    // 配额检查可能抛 ChatbotError，单独包装
    const quotaCheckPromise = checkMessageQuota(
      session.user.teamId ?? null,
    ).catch((error) => {
      if (error instanceof ChatbotError) return error;
      throw error;
    });

    const [messageCount, quotaError] = await Promise.all([
      getMessageCountByUserId({
        id: session.user.id,
        differenceInHours: 1,
      }),
      quotaCheckPromise,
    ]);

    // 套餐驱动型限流：按套餐设置小时级消息上限
    const maxPerHour = getMaxMessagesPerHour(userPlan, isAdmin);
    if (messageCount > maxPerHour) {
      return new ChatbotError("rate_limit:chat").toResponse();
    }

    // 团队配额超限
    if (quotaError instanceof ChatbotError) {
      return quotaError.toResponse();
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

    // 历史消息拉取或新建会话（summarizeTask 分支已 return，这里只处理普通聊天）
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

    // ── 并行执行：知识库检索 + 站点配置 + 消息转换 ──
    // 这三个操作互不依赖，原串行执行会浪费 5-15ms
    // 知识库检索仍保留 1.5s 超时，避免阻塞首字

    // 提取用户查询文本（知识库检索 + 工具预判共用）
    const lastUserMsg = uiMessages[uiMessages.length - 1];
    const userQueryText = lastUserMsg?.parts
      ?.filter((p: { type: string }) => p.type === "text")
      .map((p: { type: string; text?: string }) => (p as { text: string }).text)
      .join(" ") ?? "";

    // 知识库检索（带超时）
    const knowledgePromise: Promise<string> = (async () => {
      if (!(agentRecord?.isActive && agentRecord?.knowledgeId && userQueryText.trim())) {
        return "";
      }
      try {
        const retrievePromise = retrieveKnowledge({
          query: userQueryText.slice(0, 1000),
          knowledge_ids: [agentRecord.knowledgeId],
          top_k: 5,
          recall_method: "mixed",
        });
        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 1500)
        );
        const retrieveResult = await Promise.race([retrievePromise, timeoutPromise]);
        if (!isProductionEnvironment) {
          console.log("[chat] 知识库检索 query:", userQueryText.slice(0, 100));
        }
        if (
          retrieveResult &&
          retrieveResult.code === 200 &&
          retrieveResult.data &&
          retrieveResult.data.length > 0
        ) {
          const chunks = retrieveResult.data.map((r) => r.text).join("\n\n");
          return `\n\n## 知识库参考内容\n以下是从知识库中检索到的相关信息，请优先基于这些内容回答用户问题。\n\n${chunks}`;
        } else if (!retrieveResult) {
          logger.warn({ module: "chat" }, "知识库检索超时(1.5s)，跳过知识库上下文");
        }
      } catch (e) {
        logger.warn(
          { module: "chat", err: e instanceof Error ? e.message : e },
          "知识库检索失败",
        );
      }
      return "";
    })();

    // 站点配置（仅无 agent 时需要）
    const siteConfigPromise = (!agentId ? getSiteConfig() : Promise.resolve(null)).catch(() => null);

    // 消息转换
    const modelMessagesPromise = convertToModelMessages(uiMessages);

    // 并行等待三个操作
    const [knowledgeContext, siteConfig, modelMessagesRaw] = await Promise.all([
      knowledgePromise,
      siteConfigPromise,
      modelMessagesPromise,
    ]);

    // 拼接 system message
    if (agentRecord?.isActive) {
      systemMessage = `${agentRecord.systemPrompt}${knowledgeContext}\n\n${systemMessage}`;
    } else if (!agentId && siteConfig?.defaultSystemPrompt) {
      const infrastructure = infrastructurePrompt({ requestHints, supportsTools });
      systemMessage = `${siteConfig.defaultSystemPrompt}\n\n${infrastructure}`;
    }

    let modelMessages = modelMessagesRaw;
    if (modelMessages.length > MAX_CONTEXT_MESSAGES) {
      modelMessages = modelMessages.slice(-MAX_CONTEXT_MESSAGES);
    }

    // ── 工具按需加载：根据用户消息内容预判需要哪些工具 ──
    // 减少不必要的工具定义传入 LLM，降低 prompt token，加快首字速度
    // 文档类工具（createDocument/editDocument/updateDocument/requestSuggestions）始终保留，
    // 因为用户随时可能要求生成/编辑文档，预判漏掉会损失功能。
    const activeToolsList: Array<
      "getWeather" | "createDocument" | "editDocument" | "updateDocument" |
      "requestSuggestions" | "webSearch" | "codeInterpreter" | "generateImage" |
      "sendSms"
    > = [
      "createDocument",
      "editDocument",
      "updateDocument",
      "requestSuggestions",
    ];

    // 天气工具：消息提到天气/温度/降雨等关键词
    if (/天气|温度|下雨|下雪|气温|weather|forecast/i.test(userQueryText)) {
      activeToolsList.push("getWeather");
    }
    // 网页搜索：消息提到最新/今天/新闻/实时/2024/2025等时效性关键词
    if (/最新|今天|今日|新闻|实时|现在|目前|2024|2025|latest|today|news|current/i.test(userQueryText)) {
      activeToolsList.push("webSearch");
    }
    // 代码执行：消息提到运行/执行代码、计算、数据分析
    if (/运行代码|执行代码|计算|数据分析|run code|execute|calculate|data analysis/i.test(userQueryText)) {
      activeToolsList.push("codeInterpreter");
    }
    // 图片生成：消息提到画图/生成图片/绘制
    if (/画图|画一个|生成图|绘制|作图|generate image|draw|paint/i.test(userQueryText)) {
      activeToolsList.push("generateImage");
    }
    // 短信发送：消息提到发短信/通知/提醒某人/短信告知
    if (/发短信|短信通知|短信提醒|发个短信|短信告知|send sms|send message|text message/i.test(userQueryText)) {
      activeToolsList.push("sendSms");
    }

    // 推理模型不支持工具时，清空 activeTools
    const finalActiveTools = isReasoningModel && !supportsTools ? [] : activeToolsList;

    if (message?.role === "user") {
      // 使用 after() 在响应返回后异步保存用户消息
      // 避免阻塞流式响应的首字输出
      after(async () => {
        try {
          await saveMessages({
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
          });
        } catch (error) {
          logger.error(
            { module: "chat", err: error instanceof Error ? error.message : error },
            "用户消息保存失败",
          );
        }
      });
    }

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        // 按需构建工具对象：只包含 finalActiveTools 中的工具
        // 避免把 8 个工具定义全部传给 LLM，减少 prompt token，加快首字速度
        // 用 as const + 索引签名构建，保持各工具自身类型
        const tools = {
          ...(finalActiveTools.includes("getWeather") ? { getWeather } : {}),
          ...(finalActiveTools.includes("createDocument")
            ? { createDocument: createDocument({ session, dataStream, modelId: chatModel, chatId: id }) }
            : {}),
          ...(finalActiveTools.includes("editDocument")
            ? { editDocument: editDocument({ dataStream, session }) }
            : {}),
          ...(finalActiveTools.includes("updateDocument")
            ? { updateDocument: updateDocument({ session, dataStream, modelId: chatModel }) }
            : {}),
          ...(finalActiveTools.includes("requestSuggestions")
            ? { requestSuggestions: requestSuggestions({ session, dataStream, modelId: chatModel }) }
            : {}),
          ...(finalActiveTools.includes("webSearch") ? { webSearch } : {}),
          ...(finalActiveTools.includes("codeInterpreter") ? { codeInterpreter } : {}),
          ...(finalActiveTools.includes("generateImage") ? { generateImage } : {}),
          ...(finalActiveTools.includes("sendSms") ? { sendSms } : {}),
        };

        const result = await withRetry(
          () => streamText({
            model: getLanguageModel(chatModel),
            system: systemMessage,
            messages: modelMessages,
            stopWhen: stepCountIs(5),
            experimental_activeTools: finalActiveTools,
            providerOptions: {
              // 思考模式开关：thinkingEnabled 控制是否启用推理/思考
              // - 智谱 GLM thinking 模型：通过 thinking 参数控制
              // - DeepSeek：通过 reasoning_effort 控制
              // - OpenAI 兼容：通过 reasoningEffort 控制
              ...(isReasoningModel && {
                openai: {
                  reasoningEffort: thinkingEnabled
                    ? (modelConfig?.reasoningEffort ?? "medium")
                    : "none",
                },
              }),
            },
            tools,
            experimental_telemetry: { isEnabled: isProductionEnvironment, functionId: "stream-text" },
          }),
          3,
          (attempt, error, delayMs) => {
            logger.warn(
              { module: "chat", attempt, err: error instanceof Error ? error.message : error },
              "streamText retry",
            );
          }
        );

        // 推理模型（如 DeepSeek）会先输出 reasoning_content（思考过程），
        // 再输出 content（正文）。若 sendReasoning 为 false，reasoning-delta
        // 会被 toUIMessageStream 过滤掉，但 reasoning-start / reasoning-end
        // 仍然转发，导致思考阶段前端无任何文本输出 → 表现为"先出一句后卡顿，
        // 再一次性输出一大段"。
        // 修复：仅在 thinkingEnabled 为 true 时发送 reasoning，关闭思考模式时不输出思考过程。
        dataStream.merge(result.toUIMessageStream({ sendReasoning: isReasoningModel && thinkingEnabled }));

        if (titlePromise) {
          try {
            const title = await titlePromise;
            dataStream.write({ type: "data-chat-title", data: title });
            updateChatTitleById({ chatId: id, title });
          } catch (error) {
            logger.warn(
              { module: "chat", err: error instanceof Error ? error.message : error },
              "标题生成失败",
            );
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
          logger.error({ module: "chat", err: msg }, "streamText error");
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
          logger.warn(
            { module: "chat", err: error instanceof Error ? error.message : error },
            "可恢复流持久化失败",
          );
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
    logger.error(
      { module: "chat", requestId, err: error instanceof Error ? error.message : error },
      "Unhandled error in chat API",
    );
    // 上报到 Sentry（未配置 DSN 时自动降级为 console.error）
    captureException(error, { module: "chat", requestId });
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
