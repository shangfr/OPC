// hooks/use-active-chat.tsx
"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { usePathname } from "next/navigation";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import useSWR, { useSWRConfig } from "swr";

import { useDataStream } from "@/components/chat/data-stream-provider";
import { toast } from "@/components/chat/toast";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import { useAgentBinding } from "@/hooks/use-agent-binding";
import { useAutoResume } from "@/hooks/use-auto-resume";
import {
  getChatCache,
  setChatCache,
  updateChatMessages,
} from "@/hooks/use-message-cache";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import type { Vote } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { fetcher, fetchWithErrorHandlers, generateUUID } from "@/lib/utils";

type ActiveChatContextValue = {
  chatId: string;
  title: string;
  agentName: string | null;
  messages: ChatMessage[];
  status: UseChatHelpers<ChatMessage>["status"];
  input: string;
  visibilityType: VisibilityType;
  isReadonly: boolean;
  isLoading: boolean;
  votes: Vote[] | undefined;
  currentModelId: string;
  thinkingEnabled: boolean;
  agentId: string | null;
};

type ActiveChatActionsContextValue = {
  setTitle: Dispatch<SetStateAction<string>>;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  stop: UseChatHelpers<ChatMessage>["stop"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  setInput: Dispatch<SetStateAction<string>>;
  setCurrentModelId: (id: string) => void;
  setThinkingEnabled: Dispatch<SetStateAction<boolean>>;
};

const ActiveChatContext = createContext<ActiveChatContextValue | null>(null);
const ActiveChatActionsContext = createContext<ActiveChatActionsContextValue | null>(null);

function extractChatId(pathname: string): string | null {
  const match = pathname.match(/\/chat\/([^/]+)/);
  return match ? match[1] : null;
}

export function ActiveChatProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { setDataStream } = useDataStream();
  const { mutate } = useSWRConfig();

  const chatIdFromUrl = extractChatId(pathname);
  const isNewChat = !chatIdFromUrl;
  const newChatIdRef = useRef(generateUUID());
  const prevPathnameRef = useRef(pathname);

  if (isNewChat && prevPathnameRef.current !== pathname) {
    newChatIdRef.current = generateUUID();
  }
  prevPathnameRef.current = pathname;

  const chatId = chatIdFromUrl ?? newChatIdRef.current;

  const [currentModelId, setCurrentModelId] = useState(DEFAULT_CHAT_MODEL);
  const currentModelIdRef = useRef(currentModelId);
  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const thinkingEnabledRef = useRef(thinkingEnabled);
  useEffect(() => {
    thinkingEnabledRef.current = thinkingEnabled;
  }, [thinkingEnabled]);

  const isNewChatRef = useRef(isNewChat);
  useEffect(() => {
    isNewChatRef.current = isNewChat;
  }, [isNewChat]);

  const [input, setInput] = useState("");

  const cachedEntry = isNewChat ? undefined : getChatCache(chatId);
  const hasCachedMessages =
    !!cachedEntry &&
    (!cachedEntry.agentId || cachedEntry.agentName !== undefined);

  const { data: chatData, isLoading } = useSWR(
    isNewChat || hasCachedMessages
      ? null
      : `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/messages?chatId=${chatId}`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnMount: true,
      onSuccess: (data) => {
        if (data && chatId) {
          setChatCache(chatId, {
            messages: data.messages ?? [],
            agentId: data.agentId ?? null,
            visibility: data.visibility ?? "private",
            title: data.title,
            agentName: data.agentName,
          });
        }
      },
    }
  );

  const effectiveData = hasCachedMessages ? cachedEntry : chatData;

  const [title, setTitle] = useState<string>(
    isNewChat ? "" : ((effectiveData as { title?: string })?.title ?? "")
  );

  useEffect(() => {
    if (!isNewChat && effectiveData) {
      const newTitle = (effectiveData as { title?: string })?.title;
      if (newTitle) {
        setTitle(newTitle);
      }
    }
  }, [chatId, isNewChat, effectiveData]);

  useEffect(() => {
    if (isNewChat) return;
    const cached = getChatCache(chatId);
    if (cached?.title) {
      setTitle(cached.title);
    } else {
      setTitle("");
    }
  }, [chatId]); // eslint-disable-line react-hooks/exhaustive-deps

  const { agentId, agentName, agentIdRef } = useAgentBinding({
    chatId,
    chatIdFromUrl,
    isNewChat,
    effectiveData,
  });

  const initialMessages: ChatMessage[] = isNewChat
    ? []
    : (effectiveData?.messages ?? []);

  const visibility: VisibilityType = isNewChat
    ? "private"
    : (effectiveData?.visibility ?? "private");

  // 🚨 新增：用于暂存当前需要发送的 summarizeTask 标识
  const summarizeTaskRef = useRef<string | null>(null);

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
    addToolApprovalResponse,
  } = useChat<ChatMessage>({
    id: chatId,
    messages: initialMessages,
    generateId: generateUUID,
    sendAutomaticallyWhen: ({ messages: currentMessages }) => {
      const lastMessage = currentMessages.at(-1);
      return (
        lastMessage?.parts?.some(
          (part) =>
            "state" in part &&
            part.state === "approval-responded" &&
            "approval" in part &&
            (part.approval as { approved?: boolean })?.approved === true
        ) ?? false
      );
    },
    transport: new DefaultChatTransport({
      api: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat`,
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest(request) {
        const lastMessage = request.messages.at(-1);
        const isToolApprovalContinuation =
          lastMessage?.role !== "user" ||
          request.messages.some((msg) =>
            msg.parts?.some((part) => {
              const state = (part as { state?: string }).state;
              return (
                state === "approval-responded" || state === "output-denied"
              );
            })
          );

        if (!isToolApprovalContinuation && lastMessage?.role === "user") {
          mutate(
            (key: unknown) =>
              typeof key === "string" &&
              key.startsWith("$inf$") &&
              key.includes("/api/history"),
            (
              currentData:
                | Array<{
                    chats: Array<{
                      id: string;
                      createdAt: string;
                      title: string;
                      userId: string;
                      visibility: string;
                    }>;
                    hasMore: boolean;
                  }>
                | undefined
            ) => {
              if (!currentData || currentData.length === 0) {
                return currentData;
              }
              const firstPage = currentData[0];
              if (firstPage.chats.some((c) => c.id === request.id)) {
                return currentData;
              }
              const optimisticChat = {
                id: request.id,
                createdAt: new Date().toISOString(),
                title: "New chat",
                userId: "",
                visibility: "private",
              };
              return [
                { ...firstPage, chats: [optimisticChat, ...firstPage.chats] },
                ...currentData.slice(1),
              ];
            },
            { revalidate: false }
          );
        }
        // ==========================================
        // 🔥 修复核心：动态判断使用哪个 Agent ID
        // ==========================================
        
        let finalAgentIdToSend = agentIdRef.current;

        // 如果当前有待发送的汇总任务，尝试从中提取 agentId
        if (summarizeTaskRef.current) {
          try {
            const taskPayload = JSON.parse(summarizeTaskRef.current);
            if (taskPayload.agentId) {
              finalAgentIdToSend = taskPayload.agentId;
              console.log("[Hook] Overriding Agent ID for Summarize Task:", finalAgentIdToSend);
            }
          } catch (e) {
            console.warn("[Hook] Failed to parse summarizeTask for agentId");
          }
        }
        return {
          body: {
            id: request.id,
            ...(isToolApprovalContinuation
              ? { messages: request.messages }
              : { message: lastMessage }),
            selectedChatModel: currentModelIdRef.current,
            selectedVisibilityType: visibility,
            thinkingEnabled: thinkingEnabledRef.current,
            isNewChat: isNewChatRef.current,
            // ✅ 使用计算后的 finalAgentIdToSend
            ...(finalAgentIdToSend ? { agentId: finalAgentIdToSend } : {}),
            // 🚨 注入 summarizeTask 标识
            ...(summarizeTaskRef.current
              ? { summarizeTask: summarizeTaskRef.current }
              : {}),
            ...request.body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
    },
    onFinish: () => {
      mutate(
        (key: unknown) =>
          typeof key === "string" &&
          key.startsWith("$inf$") &&
          key.includes("/api/history")
      );
    },
    onError: (error) => {
      if (error instanceof ChatbotError) {
        toast({ type: "error", description: error.message });
      } else {
        toast({
          type: "error",
          description: error.message || "出错了，请稍后再试！",
        });
      }
    },
  });

  const prevChatIdForMessages = useRef<string | null>(null);
  const prevMessageCountRef = useRef<number>(0);

  useEffect(() => {
    if (isNewChat) {
      prevChatIdForMessages.current = chatId;
      prevMessageCountRef.current = 0;
      setMessages([]);
    } else if (prevChatIdForMessages.current !== chatId) {
      if (effectiveData?.messages && effectiveData.messages.length > 0) {
        prevChatIdForMessages.current = chatId;
        prevMessageCountRef.current = effectiveData.messages.length;
        setMessages(effectiveData.messages);
      } else if (!effectiveData) {
        setMessages([]);
      }
    }
  }, [chatId, isNewChat, effectiveData, setMessages]);

  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isNewChat && messages.length > 0) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        updateChatMessages(chatId, messages);
        rafRef.current = null;
      });
    }
  }, [chatId, isNewChat, messages]);

  useEffect(() => {
    if (effectiveData && isNewChat ? false : !!effectiveData) {
      const cookieModel = document.cookie
        .split("; ")
        .find((row) => row.startsWith("chat-model="))
        ?.split("=")[1];

      if (cookieModel) {
        setCurrentModelId(decodeURIComponent(cookieModel));
      }
    }
  }, [effectiveData, isNewChat]);

// 1. 记录上一次成功处理的 ChatId，而不是简单的 true/false
const processedChatIdRef = useRef<string | null>(null);

useEffect(() => {
  // ✅ 优化判断：
  // 如果当前 chatId 已经被处理过了，且 sessionStorage 也没有了，那就跳过
  // 这样既防止了重复发送，又允许同一个 chatId 刷新时仍然尝试（如果你需要的话）
  // 最重要的是：如果 chatId 变了，processedChatIdRef.current !== chatId，逻辑就会重新运行
  if (processedChatIdRef.current === chatId) {
    return; 
  }

  // 1. 检查 sessionStorage
  const storedSummaryTask = sessionStorage.getItem(`pending-summarize-task-${chatId}`);

  if (storedSummaryTask) {
    // 2. 标记这个 chatId 已经处理过了
    processedChatIdRef.current = chatId;

    // ... (原有的逻辑保持不变)
    summarizeTaskRef.current = storedSummaryTask;
    sessionStorage.removeItem(`pending-summarize-task-${chatId}`);
    window.history.replaceState(
      {},
      "",
      `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/chat/${chatId}`
    );

    sendMessage({
      role: "user" as const,
      parts: [
        {
          type: "text",
          text: "请帮我汇总并分析以上选中的对话记录",
        },
      ],
    });

    setTimeout(() => {
      summarizeTaskRef.current = null;
    }, 1000);
  } else {
    // ✅ 也要处理兼容旧逻辑
    const params = new URLSearchParams(window.location.search);
    const query = params.get("query");
    if (query) {
      processedChatIdRef.current = chatId;
      window.history.replaceState(
        {},
        "",
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/chat/${chatId}`
      );
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: query }],
      });
    }
  }
}, [sendMessage, chatId]); // ✅ 依赖项保持不变，确保 chatId 变化时触发


  useAutoResume({
    autoResume: isNewChat ? false : !!effectiveData,
    initialMessages,
    resumeStream,
    setMessages,
  });

  const isReadonly = isNewChat ? false : (effectiveData?.isReadonly ?? false);

  const { data: votes } = useSWR<Vote[]>(
    !isReadonly && messages.length >= 2
      ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/vote?chatId=${chatId}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const stateValue = useMemo<ActiveChatContextValue>(
    () => ({
      chatId,
      title,
      agentName,
      messages,
      status,
      input,
      visibilityType: visibility,
      isReadonly,
      isLoading: !isNewChat && isLoading,
      votes,
      currentModelId,
      thinkingEnabled,
      agentId,
    }),
    [
      chatId,
      title,
      agentName,
      messages,
      status,
      input,
      visibility,
      isReadonly,
      isNewChat,
      isLoading,
      votes,
      currentModelId,
      thinkingEnabled,
      agentId,
    ]
  );

  const actionsValue = useMemo<ActiveChatActionsContextValue>(
    () => ({
      setTitle,
      setMessages,
      sendMessage,
      stop,
      regenerate,
      addToolApprovalResponse,
      setInput,
      setCurrentModelId,
      setThinkingEnabled,
    }),
    [
      setTitle,
      setMessages,
      sendMessage,
      stop,
      regenerate,
      addToolApprovalResponse,
      setInput,
      setCurrentModelId,
      setThinkingEnabled,
    ]
  );

  return (
    <ActiveChatActionsContext.Provider value={actionsValue}>
      <ActiveChatContext.Provider value={stateValue}>
        {children}
      </ActiveChatContext.Provider>
    </ActiveChatActionsContext.Provider>
  );
}

export function useActiveChat() {
  const state = useContext(ActiveChatContext);
  const actions = useContext(ActiveChatActionsContext);

  if (!state || !actions) {
    throw new Error("useActiveChat must be used within ActiveChatProvider");
  }

  return { ...state, ...actions };
}

export function useActiveChatActions() {
  const actions = useContext(ActiveChatActionsContext);

  if (!actions) {
    throw new Error(
      "useActiveChatActions must be used within ActiveChatProvider"
    );
  }

  return actions;
}
