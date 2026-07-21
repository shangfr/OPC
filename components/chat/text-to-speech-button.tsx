"use client";

/**
 * TextToSpeechButton — 语音播报按钮
 *
 * 集成到 message-actions，点击朗读该条 AI 回复。
 * 再次点击停止朗读。
 *
 * 使用 shadcn/ui 风格的 MessageAction 组件，与复制/点赞按钮一致。
 */

import { Volume2Icon, VolumeXIcon, Loader2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { MessageAction } from "../ai-elements/message";

export interface TextToSpeechButtonProps {
  /** 要朗读的文本 */
  text: string;
  /** 朗读语言，默认 zh-CN */
  lang?: string;
  /** 消息 ID（用于唯一标识，避免跨消息状态污染） */
  messageId: string;
}

function PureTextToSpeechButton({
  text,
  lang = "zh-CN",
  messageId,
}: TextToSpeechButtonProps) {
  const { speak, stop, speaking, supported, voices } = useSpeechSynthesis({
    lang,
  });

  // 当前按钮是否正在朗读这条消息（全局 speaking + 本消息激活标记）
  const [isActive, setIsActive] = useState(false);
  // 用 ref 保存 isActive，避免 handleClick 闭包捕获旧值导致无法停止
  const isActiveRef = useRef(false);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // 当全局 speaking 变为 false 时，重置本消息激活状态
  useEffect(() => {
    if (!speaking) {
      setIsActive(false);
      isActiveRef.current = false;
    }
  }, [speaking]);

  if (!supported || !text.trim()) {
    return null;
  }

  const handleClick = () => {
    // 只要本按钮处于激活状态就停止，不依赖 speaking（避免 onstart 事件延迟导致无法停止）
    if (isActiveRef.current) {
      stop();
      setIsActive(false);
      isActiveRef.current = false;
      return;
    }

    // 中文语音优先
    const zhVoice = voices.find(
      (v) => v.lang === "zh-CN" || v.lang.startsWith("zh"),
    );

    try {
      // 先取消可能正在进行的其他朗读
      stop();
      speak(text, {
        lang,
        rate: 1,
        pitch: 1,
        ...(zhVoice ? {} : {}),
      });
      isActiveRef.current = true;
      setIsActive(true);
    } catch {
      toast.error("语音播报启动失败");
    }
  };

  return (
    <MessageAction
      aria-label={isActive ? "停止朗读" : "朗读回复"}
      data-testid={`tts-button-${messageId}`}
      onClick={handleClick}
      tooltip={isActive ? "停止朗读" : "朗读"}
      className={
        isActive
          ? "size-8 text-primary hover:text-primary"
          : "size-8 text-muted-foreground/50 hover:text-foreground"
      }
    >
      {isActive ? (
        <VolumeXIcon className="size-4" />
      ) : (
        <Volume2Icon className="size-4" />
      )}
    </MessageAction>
  );
}

export const TextToSpeechButton = PureTextToSpeechButton;
