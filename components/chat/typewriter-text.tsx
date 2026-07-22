"use client";

/**
 * TypewriterText — 匀速打字机文本渲染组件
 *
 * 将流式文本通过 useTypewriter hook 匀速渲染。
 * 仅对正在流式输出的最后一条 assistant 消息生效。
 *
 * 交互：点击文本区域跳过动画
 */

import { memo, useCallback } from "react";
import { useTypewriter } from "@/hooks/use-typewriter";
import { sanitizeText, cn } from "@/lib/utils";
import { MessageContent, MessageResponse } from "../ai-elements/message";

interface TypewriterTextProps {
  messageId: string;
  text: string;
  isStreaming: boolean;
  isUser: boolean;
  testId?: string;
}

function PureTypewriterText({
  messageId,
  text,
  isStreaming,
  isUser,
  testId,
}: TypewriterTextProps) {
  const { displayedText, isTyping, skip } = useTypewriter({
    text: sanitizeText(text),
    messageId,
    isActive: isStreaming,
    enabled: !isUser,
    speed: 30,
  });

  // 始终绑定 onClick，内部判断是否需要跳过
  const handleClick = useCallback(() => {
    if (isTyping) {
      skip();
    }
  }, [isTyping, skip]);

  return (
    <MessageContent
      className={cn("text-[16px] leading-[1.65] font-medium", {
        "w-fit max-w-[min(80%,56ch)] overflow-hidden break-words rounded-2xl rounded-br-lg border border-emerald-500/30 bg-emerald-600 px-3.5 py-2 text-white shadow-[0_0_12px_var(--accent-glow)] dark:shadow-[0_0_18px_var(--accent-glow)]":
          isUser,
      })}
      data-testid={testId ?? "message-content"}
      onClick={handleClick}
      style={isTyping ? { cursor: "pointer" } : undefined}
    >
      <MessageResponse>{displayedText}</MessageResponse>
      {isTyping && !isUser && (
        <span className="ml-0.5 inline-block h-[1.1em] w-[2.5px] animate-pulse rounded-full bg-primary/80 align-middle shadow-[0_0_6px_var(--primary)]" />
      )}
    </MessageContent>
  );
}

export const TypewriterText = memo(PureTypewriterText, (prev, next) => {
  return (
    prev.messageId === next.messageId &&
    prev.text === next.text &&
    prev.isStreaming === next.isStreaming &&
    prev.isUser === next.isUser &&
    prev.testId === next.testId
  );
});
