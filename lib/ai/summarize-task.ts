// lib/ai/summarize-task.ts
// 对话汇总任务 — 从 chat/route.ts 抽取，避免主路由文件过度膨胀

import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
} from "ai";
import type { Session } from "next-auth";
import {
  infrastructurePrompt,
  systemPrompt,
  type RequestHints,
} from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { withRetry } from "@/lib/ai/retry";
import { retrieve as retrieveKnowledge } from "@/lib/ai/zhipu-knowledge";
import { createDocument } from "@/lib/ai/tools/create-document";
import { editDocument } from "@/lib/ai/tools/edit-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import {
  getChatById,
  getMessagesByChatId,
  getSiteConfig,
  saveChat,
  saveMessages,
} from "@/lib/db/queries";
import type { Agent } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import { generateUUID } from "@/lib/utils";

// 汇总任务最大对话数限制，防止恶意传入超大数组
const MAX_SUMMARIZE_CHATS = 50;

const EMPTY_HINTS: RequestHints = {
  latitude: undefined,
  longitude: undefined,
  city: undefined,
  country: undefined,
};

interface SummarizeTaskParams {
  chatId: string;
  userMessage: { id: string; role: string; parts: unknown[] } | undefined;
  selectedVisibilityType: "public" | "private";
  agentId: string | undefined;
  agentRecord: Agent | null;
  chatModel: string;
  session: Session;
  summarizeTask: string;
}

export async function handleSummarizeTask(
  params: SummarizeTaskParams,
): Promise<Response> {
  const {
    chatId,
    userMessage,
    selectedVisibilityType,
    agentId,
    agentRecord,
    chatModel,
    session,
    summarizeTask,
  } = params;

  // ── 参数解析与校验 ──
  // Fix: 验证 chatIds 元素类型为字符串，限制最大数量
  let targetChatIds: string[];
  try {
    const parsed = JSON.parse(summarizeTask);
    if (!parsed || !Array.isArray(parsed.chatIds)) {
      return new ChatbotError(
        "bad_request:chat",
        "汇总任务参数格式不正确",
      ).toResponse();
    }
    // 验证每个元素都是字符串，防止恶意输入
    if (!parsed.chatIds.every((id: unknown) => typeof id === "string")) {
      return new ChatbotError(
        "bad_request:chat",
        "汇总任务参数格式不正确",
      ).toResponse();
    }
    // 限制最大数量，防止恶意传入超大数组导致 DB 过载
    if (parsed.chatIds.length > MAX_SUMMARIZE_CHATS) {
      return new ChatbotError(
        "bad_request:chat",
        `汇总对话数量不能超过 ${MAX_SUMMARIZE_CHATS} 个`,
      ).toResponse();
    }
    targetChatIds = parsed.chatIds;
  } catch {
    return new ChatbotError(
      "bad_request:chat",
      "汇总任务参数格式不正确",
    ).toResponse();
  }

  // 1. 创建新对话记录
  await saveChat({
    id: chatId,
    userId: session.user.id,
    title: "信息汇总分析",
    visibility: selectedVisibilityType,
    agentId: agentId,
    agentName: agentRecord?.name ?? null,
    teamId: session.user.teamId ?? null,
  });

  // 2. 拉取历史记录 — 使用 Promise.all 并行查询，避免 N+1
  const targetChats = await Promise.all(
    targetChatIds.map((id) => getChatById({ id })),
  );

  // 过滤出属于当前用户的对话
  const validChats = targetChats.filter(
    (c): c is NonNullable<typeof c> =>
      c !== null && c.userId === session.user.id,
  );

  // 批量获取所有有效对话的消息
  const allMessages = await Promise.all(
    validChats.map((c) => getMessagesByChatId({ id: c.id })),
  );

  // 拼装历史记录上下文
  const historyMessagesForContext: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }> = [];

  for (let i = 0; i < validChats.length; i++) {
    const targetChat = validChats[i];
    const msgs = allMessages[i];

    // 添加对话标题作为分隔符，帮助大模型区分不同上下文
    historyMessagesForContext.push({
      role: "user",
      content: `--- 以下是对话《${targetChat.title}》的记录 ---`,
    });

    for (const m of msgs) {
      const text = Array.isArray(m.parts)
        ? m.parts
            .filter((p: { type: string }) => p.type === "text")
            .map((p: { text?: string }) => p.text ?? "")
            .join("")
        : "";
      if (text) {
        historyMessagesForContext.push({
          role: m.role as "user" | "assistant" | "system",
          content: text,
        });
      }
    }
  }

  // 3. 追加总结指令
  historyMessagesForContext.push({
    role: "user",
    content:
      "请基于以上多个对话的内容，融合你擅长的领域知识，生成一份综合分析报告。**重要：请务必调用 createDocument 工具生成一个文档来展示这份报告。** 要求：1. 提取核心主题；2. 归纳关键信息；3. 分析共同点与差异；4. 给出后续行动建议。",
  });

  // 4. 初始化 System Prompt
  let systemMessage = systemPrompt({
    requestHints: EMPTY_HINTS,
    supportsTools: true,
  });

  // 5. 知识库检索 (RAG)
  let knowledgeContext = "";
  if (agentRecord?.isActive && agentRecord?.knowledgeId) {
    try {
      const lastMsg =
        historyMessagesForContext[historyMessagesForContext.length - 1];
      const queryText = lastMsg?.content ?? "信息汇总分析";

      const retrieveResult = await retrieveKnowledge({
        query: queryText.slice(0, 1000),
        knowledge_ids: [agentRecord.knowledgeId],
        top_k: 5,
        recall_method: "mixed",
      });

      if (
        retrieveResult.code === 200 &&
        retrieveResult.data &&
        retrieveResult.data.length > 0
      ) {
        const chunks = retrieveResult.data.map((r) => r.text).join("\n\n");
        knowledgeContext = `\n\n## 知识库参考内容\n以下是从知识库中检索到的相关信息，请优先基于这些内容回答用户问题。\n\n${chunks}`;
      }
    } catch (e) {
      console.warn(
        "[chat:summarize] 知识库检索失败:",
        e instanceof Error ? e.message : e,
      );
    }
  }

  // 6. 组装最终 System Prompt
  // 优先级：Agent Prompt > 知识库内容 > 基础 System Prompt
  if (agentRecord?.isActive) {
    systemMessage = `${agentRecord.systemPrompt}${knowledgeContext}\n\n${systemMessage}`;
  } else if (!agentId) {
    const config = await getSiteConfig();
    if (config?.defaultSystemPrompt) {
      const infrastructure = infrastructurePrompt({
        requestHints: EMPTY_HINTS,
        supportsTools: true,
      });
      systemMessage = `${config.defaultSystemPrompt}\n\n${infrastructure}`;
    }
  }

  // 7. 转换为模型可用格式
  const modelMessages = historyMessagesForContext.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  // 8. 保存用户触发消息
  if (userMessage?.role === "user") {
    await saveMessages({
      messages: [
        {
          chatId,
          id: userMessage.id,
          role: "user",
          parts: userMessage.parts as any,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });
  }

  // 9. 流式调用大模型
  const stream = createUIMessageStream({
    execute: async ({ writer: dataStream }) => {
      const result = await withRetry(
        () =>
          streamText({
            model: getLanguageModel(chatModel),
            system: systemMessage,
            messages: modelMessages,
            experimental_activeTools: [
              "getWeather",
              "createDocument",
              "editDocument",
              "updateDocument",
              "requestSuggestions",
            ],
            tools: {
              getWeather,
              createDocument: createDocument({
                session,
                dataStream,
                modelId: chatModel,
                chatId,
              }),
              editDocument: editDocument({ dataStream, session }),
              updateDocument: updateDocument({
                session,
                dataStream,
                modelId: chatModel,
              }),
              requestSuggestions: requestSuggestions({
                session,
                dataStream,
                modelId: chatModel,
              }),
            },
          }),
        2,
        (attempt, error, _delayMs) => {
          console.warn(
            `[chat:summarize] streamText retry ${attempt}:`,
            error instanceof Error ? error.message : error,
          );
        },
      );

      dataStream.merge(result.toUIMessageStream());
    },
    generateId: generateUUID,
    onFinish: async ({ messages: finishedMessages }) => {
      if (finishedMessages.length > 0) {
        await saveMessages({
          messages: finishedMessages.map((currentMessage) => ({
            id: currentMessage.id,
            role: currentMessage.role,
            parts: currentMessage.parts,
            createdAt: new Date(),
            attachments: [],
            chatId,
          })),
        });
      }
    },
    onError: (error) => "Oops, an error occurred!",
  });

  return createUIMessageStreamResponse({ stream });
}
