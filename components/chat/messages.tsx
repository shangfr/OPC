import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDownIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { cardVariants } from "@/components/ui/card";
import { useActiveChat } from "@/hooks/use-active-chat";
import { useChatNotification } from "@/hooks/use-chat-notification";
import { useMessages } from "@/hooks/use-messages";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useDataStream } from "./data-stream-provider";
import { Greeting } from "./greeting";
import { PreviewMessage } from "./message";

type MessagesProps = {
  isArtifactVisible: boolean;
  onEditMessage?: (message: ChatMessage) => void;
  onSelectPrompt?: (prompt: string) => void;
};

function PureMessages({
  isArtifactVisible,
  onEditMessage,
  onSelectPrompt,
}: MessagesProps) {
  const {
    chatId,
    messages,
    status,
    votes,
    isReadonly,
    isLoading,
    currentModelId: selectedModelId,
  } = useActiveChat();
  const { addToolApprovalResponse, setMessages, regenerate } = useActiveChat();
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    isAtBottom,
    scrollToBottom,
    hasSentMessage,
    reset,
  } = useMessages({
    status,
  });

  useDataStream();

  // 计算最后一条助手消息的索引，用于显示"重新生成"按钮
  const lastAssistantIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        return i;
      }
    }
    return -1;
  })();

  // 浏览器通知：Agent 回复完成时自动桌面通知
  const lastAssistantMessage =
    lastAssistantIndex >= 0 ? messages[lastAssistantIndex] : undefined;
  useChatNotification({
    status,
    lastAssistantMessage,
    agentName: undefined, // 由父组件传入或从 chat 元数据读取，此处留空
  });

  // P2: Virtual scrolling for long conversations
  const virtualizer = useVirtualizer({
    count:
      messages.length +
      (status === "submitted" && messages.at(-1)?.role !== "assistant"
        ? 1
        : 0) +
      1, // +1 for thinking, +1 for end spacer
    getScrollElement: () => messagesContainerRef.current,
    estimateSize: () => 120,
    overscan: 5,
    enabled: messages.length > 30, // Only virtualize for long conversations
  });

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      reset();
    }
  }, [chatId, reset]);

  return (
    <div className="relative flex-1 bg-background">
      {messages.length === 0 && !isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <Greeting onSelectPrompt={onSelectPrompt} />
        </div>
      )}
      <div
        aria-atomic="false"
        aria-live="polite"
        className={cn(
          "absolute inset-0 touch-pan-y overflow-y-auto",
          messages.length > 0 ? "bg-background" : "bg-transparent"
        )}
        ref={messagesContainerRef}
        role="log"
        style={isArtifactVisible ? { scrollbarWidth: "none" } : undefined}
      >
        <div className="mx-auto flex min-h-full min-w-0 max-w-4xl flex-col gap-5 px-2 py-6 md:gap-7 md:px-4">
          {messages.length > 30 ? (
            <>
              {/* Virtualized rendering for 30+ messages */}
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const index = virtualRow.index;
                  if (index < messages.length) {
                    const message = messages[index];
                    const isLastAndStreaming =
                      status === "streaming" && messages.length - 1 === index;
                    return (
                      <div
                        data-index={index}
                        key={message.id}
                        // 流式输出时禁用 measureElement，避免每个 token 触发 ResizeObserver 重算
                        ref={isLastAndStreaming ? undefined : virtualizer.measureElement}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <PreviewMessage
                          addToolApprovalResponse={addToolApprovalResponse}
                          chatId={chatId}
                          isLastAssistant={index === lastAssistantIndex}
                          isLoading={isLastAndStreaming}
                          isReadonly={isReadonly}
                          message={message}
                          onEdit={onEditMessage}
                          regenerate={regenerate}
                          requiresScrollPadding={
                            hasSentMessage && index === messages.length - 1
                          }
                          selectedModelId={selectedModelId}
                          setMessages={setMessages}
                          vote={
                            votes
                              ? votes.find(
                                  (vote) => vote.messageId === message.id
                                )
                              : undefined
                          }
                        />
                      </div>
                    );
                  }
                  if (
                    index === messages.length &&
                    status === "submitted" &&
                    messages.at(-1)?.role !== "assistant"
                  ) {
                    // submitted 阶段：渲染一个空的 assistant PreviewMessage（内部会显示 Skeleton）
                    // 保持与真实消息相同的 DOM 结构，避免切换闪烁
                    const placeholderMessage: ChatMessage = {
                      id: generateUUID(),
                      role: "assistant",
                      parts: [],
                      metadata: { createdAt: new Date().toISOString() },
                    } as ChatMessage;
                    return (
                      <div
                        data-index={index}
                        key="thinking"
                        ref={virtualizer.measureElement}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <PreviewMessage
                          addToolApprovalResponse={addToolApprovalResponse}
                          chatId={chatId}
                          isLastAssistant={false}
                          isLoading={true}
                          isReadonly={isReadonly}
                          message={placeholderMessage}
                          regenerate={regenerate}
                          requiresScrollPadding={false}
                          selectedModelId={selectedModelId}
                          setMessages={setMessages}
                          vote={undefined}
                        />
                      </div>
                    );
                  }
                  return (
                    <div
                      data-index={index}
                      key="spacer"
                      ref={virtualizer.measureElement}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <div
                        className="min-h-[24px] min-w-[24px] shrink-0"
                        ref={messagesEndRef}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* Normal rendering for ≤ 30 messages */}
              {messages.map((message, index) => (
                <PreviewMessage
                  addToolApprovalResponse={addToolApprovalResponse}
                  chatId={chatId}
                  isLastAssistant={index === lastAssistantIndex}
                  isLoading={
                    status === "streaming" && messages.length - 1 === index
                  }
                  isReadonly={isReadonly}
                  key={message.id}
                  message={message}
                  onEdit={onEditMessage}
                  regenerate={regenerate}
                  requiresScrollPadding={
                    hasSentMessage && index === messages.length - 1
                  }
                  selectedModelId={selectedModelId}
                  setMessages={setMessages}
                  vote={
                    votes
                      ? votes.find((vote) => vote.messageId === message.id)
                      : undefined
                  }
                />
              ))}

              {status === "submitted" &&
                messages.at(-1)?.role !== "assistant" && (
                  <PreviewMessage
                    addToolApprovalResponse={addToolApprovalResponse}
                    chatId={chatId}
                    isLastAssistant={false}
                    isLoading={true}
                    isReadonly={isReadonly}
                    key="thinking-placeholder"
                    message={
                      {
                        id: generateUUID(),
                        role: "assistant",
                        parts: [],
                        metadata: { createdAt: new Date().toISOString() },
                      } as ChatMessage
                    }
                    regenerate={regenerate}
                    requiresScrollPadding={false}
                    selectedModelId={selectedModelId}
                    setMessages={setMessages}
                    vote={undefined}
                  />
                )}

              <div
                className="min-h-[24px] min-w-[24px] shrink-0"
                ref={messagesEndRef}
              />
            </>
          )}
        </div>
      </div>

      <button
        aria-label="滚动到底部"
        className={cn(
          "absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center justify-center size-9 transition-all duration-200",
          cardVariants({
            variant: "glass",
            padding: "none",
            className: "rounded-full",
          }),
          isAtBottom
            ? "pointer-events-none scale-90 opacity-0"
            : "pointer-events-auto scale-100 opacity-100"
        )}
        onClick={() => scrollToBottom("smooth")}
        type="button"
      >
        <ArrowDownIcon className="size-4 text-muted-foreground" />
      </button>
    </div>
  );
}

export const Messages = PureMessages;
