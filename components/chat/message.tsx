"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import Image from "next/image";
import { memo } from "react";
import { chatModels } from "@/lib/ai/models";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { MessageContent, MessageResponse } from "../ai-elements/message";
import { ModelSelectorLogo } from "../ai-elements/model-selector";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "../ai-elements/tool";
import { Skeleton } from "../ui/skeleton";
import { useDataStream } from "./data-stream-provider";
import { DocumentToolResult } from "./document";
import { DocumentPreview } from "./document-preview";
import { MessageActions } from "./message-actions";
import { MessageReasoning } from "./message-reasoning";
import { PreviewAttachment } from "./preview-attachment";
import { TypewriterText } from "./typewriter-text";
import { Weather } from "./weather";

type PreviewMessageProps = {
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
  onEdit?: (message: ChatMessage) => void;
  selectedModelId: string;
  isLastAssistant?: boolean;
};

const PurePreviewMessage = ({
  addToolApprovalResponse,
  chatId,
  message,
  vote,
  isLoading,
  setMessages: _setMessages,
  regenerate,
  isReadonly,
  requiresScrollPadding: _requiresScrollPadding,
  onEdit,
  selectedModelId,
  isLastAssistant,
}: PreviewMessageProps) => {
  const currentModel = chatModels.find((m) => m.id === selectedModelId);
  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === "file"
  );

  useDataStream();

  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  const attachments = attachmentsFromMessage.length > 0 && (
    <div
      className="flex flex-row justify-end gap-2"
      data-testid={"message-attachments"}
    >
      {attachmentsFromMessage.map((attachment) => (
        <PreviewAttachment
          attachment={{
            name: attachment.filename ?? "file",
            contentType: attachment.mediaType,
            url: attachment.url,
          }}
          key={attachment.url}
        />
      ))}
    </div>
  );

  const mergedReasoning = message.parts?.reduce(
    (acc, part) => {
      if (part.type === "reasoning" && part.text?.trim().length > 0) {
        return {
          text: acc.text ? `${acc.text}\n\n${part.text}` : part.text,
          isStreaming: "state" in part ? part.state === "streaming" : false,
          rendered: false,
        };
      }
      return acc;
    },
    { text: "", isStreaming: false, rendered: false }
  ) ?? { text: "", isStreaming: false, rendered: false };

  const parts = message.parts?.map((part, index) => {
    const { type } = part;
    const key = `message-${message.id}-part-${index}`;

    if (type === "reasoning") {
      if (!mergedReasoning.rendered && mergedReasoning.text) {
        mergedReasoning.rendered = true;
        return (
          <MessageReasoning
            isLoading={isLoading || mergedReasoning.isStreaming}
            key={key}
            reasoning={mergedReasoning.text}
          />
        );
      }
      return null;
    }

    if (type === "text") {
      // 最后一条 assistant 消息：使用匀速打字机渲染
      // 仅在流式输出（isLoading）时启用打字机队列
      // 历史消息（非流式）和用户消息直接显示全文，避免打字机效果
      const useTypewriterForThis = isAssistant && isLastAssistant && isLoading;

      if (useTypewriterForThis) {
        return (
          <TypewriterText
            isStreaming={isLoading}
            isUser={false}
            key={key}
            messageId={message.id}
            text={part.text}
          />
        );
      }

      return (
        <MessageContent
          className={cn("text-[16px] leading-[1.65] font-medium", {
          "w-fit max-w-[min(80%,56ch)] overflow-hidden break-words rounded-2xl rounded-br-lg border border-emerald-500/30 bg-emerald-600 px-3.5 py-2 text-white shadow-[0_0_12px_var(--accent-glow)] dark:shadow-[0_0_18px_var(--accent-glow)]": message.role === "user",
      })}
          data-testid="message-content"
          key={key}
        >
          <MessageResponse>{sanitizeText(part.text)}</MessageResponse>
        </MessageContent>
      );
    }

    if (type === "tool-getWeather") {
      const { toolCallId, state } = part;
      const approvalId = (part as { approval?: { id: string } }).approval?.id;
      const isDenied =
        state === "output-denied" ||
        (state === "approval-responded" &&
          (part as { approval?: { approved?: boolean } }).approval?.approved ===
            false);
      const widthClass = "w-[min(100%,450px)]";

      if (state === "output-available" && part.output?.hourly?.temperature_2m) {
        return (
          <div className={widthClass} key={toolCallId}>
            <Weather weatherAtLocation={part.output} />
          </div>
        );
      }

      if (isDenied) {
        return (
          <div className={widthClass} key={toolCallId}>
            <Tool className="w-full" defaultOpen={true}>
              <ToolHeader state="output-denied" type="tool-getWeather" />
              <ToolContent>
                <div className="px-4 py-3 text-muted-foreground text-sm">
                  天气查询被拒绝。
                </div>
              </ToolContent>
            </Tool>
          </div>
        );
      }

      if (state === "approval-responded") {
        return (
          <div className={widthClass} key={toolCallId}>
            <Tool className="w-full" defaultOpen={true}>
              <ToolHeader state={state} type="tool-getWeather" />
              <ToolContent>
                <ToolInput input={part.input} />
              </ToolContent>
            </Tool>
          </div>
        );
      }

      return (
        <div className={widthClass} key={toolCallId}>
          <Tool className="w-full" defaultOpen={true}>
            <ToolHeader state={state} type="tool-getWeather" />
            <ToolContent>
              {(state === "input-available" ||
                state === "approval-requested") && (
                <ToolInput input={part.input} />
              )}
              {state === "approval-requested" && approvalId && (
                <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
                  <button
                    aria-label="拒绝此工具调用"
                    className="rounded-md px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => {
                      addToolApprovalResponse({
                        id: approvalId,
                        approved: false,
                        reason: "User denied weather lookup",
                      });
                    }}
                    type="button"
                  >
                    拒绝
                  </button>
                  <button
                    aria-label="允许此工具调用"
                    className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-sm transition-colors hover:bg-primary/90"
                    onClick={() => {
                      addToolApprovalResponse({
                        id: approvalId,
                        approved: true,
                      });
                    }}
                    type="button"
                  >
                    允许
                  </button>
                </div>
              )}
            </ToolContent>
          </Tool>
        </div>
      );
    }

    if (type === "tool-createDocument") {
      const { toolCallId } = part;

      if (part.output && "error" in part.output) {
        return (
          <div
            className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-destructive dark:bg-destructive/10"
            key={toolCallId}
          >
            创建文档失败: {String(part.output.error)}
          </div>
        );
      }

      return (
        <DocumentPreview
          isReadonly={isReadonly}
          key={toolCallId}
          result={part.output}
        />
      );
    }

    if (type === "tool-updateDocument") {
      const { toolCallId } = part;

      if (part.output && "error" in part.output) {
        return (
          <div
            className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-destructive dark:bg-destructive/10"
            key={toolCallId}
          >
            更新文档失败: {String(part.output.error)}
          </div>
        );
      }

      return (
        <div className="relative" key={toolCallId}>
          <DocumentPreview
            args={{ ...part.output, isUpdate: true }}
            isReadonly={isReadonly}
            result={part.output}
          />
        </div>
      );
    }

    if (type === "tool-requestSuggestions") {
      const { toolCallId, state } = part;

      return (
        <Tool
          className="w-[min(100%,450px)]"
          defaultOpen={true}
          key={toolCallId}
        >
          <ToolHeader state={state} type="tool-requestSuggestions" />
          <ToolContent>
            {state === "input-available" && <ToolInput input={part.input} />}
            {state === "output-available" && (
              <ToolOutput
                errorText={undefined}
                output={
                  "error" in part.output ? (
                    <div className="rounded border p-2 text-destructive">
                      错误: {String(part.output.error)}
                    </div>
                  ) : (
                    <DocumentToolResult
                      isReadonly={isReadonly}
                      result={part.output}
                      type="request-suggestions"
                    />
                  )
                }
              />
            )}
          </ToolContent>
        </Tool>
      );
    }

    if (type === "data-stopped") {
      return (
        <div
          className="flex items-center gap-1.5 text-muted-foreground/70 text-xs italic"
          key={key}
        >
          <span className="size-1.5 rounded-full bg-muted-foreground/50" />
          回复已停止
        </div>
      );
    }

    return null;
  });

  const actions = !isReadonly && (
    <MessageActions
      chatId={chatId}
      isLastAssistant={isLastAssistant}
      isLoading={isLoading}
      key={`action-${message.id}`}
      message={message}
      onEdit={onEdit ? () => onEdit(message) : undefined}
      onRegenerate={
        isLastAssistant && message.role === "assistant"
          ? () => regenerate()
          : undefined
      }
      vote={vote}
    />
  );

  // 流式输出时，判断是否还没有任何可见内容（text / reasoning / tool）
  // 此时显示 Skeleton 占位，但保持外层 DOM 结构与真实消息一致，避免切换闪烁
  const hasVisibleContent = message.parts?.some((part) => {
    if (part.type === "text") {
      return (part as { text?: string }).text?.trim();
    }
    if (part.type === "reasoning") {
      return (part as { text?: string }).text?.trim();
    }
    // 动态工具（webSearch / codeInterpreter / generateImage 等）类型为 "dynamic-tool"
    // 以及所有静态工具类型
    if (
      part.type === "dynamic-tool" ||
      part.type === "tool-getWeather" ||
      part.type === "tool-createDocument" ||
      part.type === "tool-updateDocument" ||
      part.type === "tool-requestSuggestions"
    ) {
      return true;
    }
    return false;
  });

  const showSkeleton = isAssistant && isLoading && !hasVisibleContent;

  const skeletonContent = (
    <div className="flex w-full max-w-md flex-col gap-2 py-1">
      <span className="sr-only">正在生成回复中</span>
      {/* 思考指示器：三个跳动圆点 + 文字提示，参考智谱清言/豆包 */}
      <div className="flex items-center gap-2 text-muted-foreground">
        <div className="flex items-center gap-1">
          <span className="size-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.3s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.15s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-primary/60" />
        </div>
        <span className="text-xs">正在思考...</span>
      </div>
      <Skeleton className="h-3.5 w-16" />
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-4/5" />
      <Skeleton className="h-3.5 w-3/5" />
    </div>
  );

  const content = showSkeleton ? (
    skeletonContent
  ) : (
    <>
      {attachments}
      {parts}
      {actions}
    </>
  );

  return (
    <div
      className={cn(
        "group/message w-full",
        !isAssistant && "animate-[fade-up_0.25s_cubic-bezier(0.22,1,0.36,1)]"
      )}
      data-role={message.role}
      data-testid={`message-${message.role}`}
    >
      <div
        className={cn(
          isUser
            ? "flex items-start justify-end gap-3"
            : "flex items-start gap-3"
        )}
      >
        {isAssistant && (
          <div className="hidden md:flex h-[calc(13px*1.65)] shrink-0 items-center">
            <div className="flex size-7 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground ring-1 ring-border/50">
              {currentModel ? (
                <ModelSelectorLogo
                  className="size-[13px]"
                  provider={currentModel.provider}
                />
              ) : (
                <ModelSelectorLogo
                  className="size-[13px]"
                  provider={chatModels[0]?.provider ?? "openai"}
                />
              )}
            </div>
          </div>
        )}
        {isAssistant ? (
          <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-xl bg-muted/50 px-3.5 py-2.5 ring-1 ring-border/40">
            {content}
          </div>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 flex-col gap-2 items-end">
              {content}
            </div>
            <div className="mt-2 hidden md:flex shrink-0 items-center">
              <div className="flex size-7 items-center justify-center overflow-hidden rounded-lg bg-muted/60 ring-1 ring-border/50">
                <Image
                  alt="User"
                  className="size-full object-cover"
                  height={28}
                  src="/icon.png"
                  unoptimized
                  width={28}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// memo 比较：只在关键 props 变化时重渲染
// useChat 更新 messages 时，只有最后一条消息引用会变，历史消息可跳过重渲染
const areEqual = (prev: PreviewMessageProps, next: PreviewMessageProps) => {
  return (
    prev.message === next.message &&
    prev.vote === next.vote &&
    prev.isLoading === next.isLoading &&
    prev.isReadonly === next.isReadonly &&
    prev.isLastAssistant === next.isLastAssistant &&
    prev.selectedModelId === next.selectedModelId
  );
};

export const PreviewMessage = memo(PurePreviewMessage, areEqual);
