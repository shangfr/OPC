"use client";

/**
 * VoiceInputButton — 语音输入按钮
 *
 * 集成到 multimodal-input 工具栏，点击开始语音识别，
 * 识别结果实时填入输入框。
 *
 * 使用 shadcn/ui Button + Tooltip 组件，与现有工具栏风格一致。
 */

import { MicIcon, MicOffIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export interface VoiceInputButtonProps {
  /** 当前输入框文本（用于在已有内容后追加） */
  value: string;
  /** 输入框 setter */
  onChange: (value: string) => void;
  /** 识别语言，默认 zh-CN */
  lang?: string;
  /** 是否禁用 */
  disabled?: boolean;
}

function PureVoiceInputButton({
  value,
  onChange,
  lang = "zh-CN",
  disabled = false,
}: VoiceInputButtonProps) {
  // 保存最新的 value，避免 onResult 闭包捕获旧值
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const { isListening, supported, error, start, stop, transcript } =
    useSpeechRecognition({
      lang,
      continuous: false,
      interimResults: true,
      onResult: (finalText) => {
        // 最终结果追加到输入框末尾
        const base = valueRef.current.replace(/\s+$/, "");
        onChange(base + finalText);
      },
    });

  // 错误提示
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  // 不支持的浏览器：按钮置灰，tooltip 提示
  if (!supported) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={-1} className="inline-flex">
            <Button
              aria-label="语音输入（浏览器不支持）"
              className="h-8 w-8 rounded-lg border border-border/40 p-1 text-muted-foreground/30 cursor-not-allowed"
              disabled
              variant="ghost"
              type="button"
            >
              <MicOffIcon className="size-3.5" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>当前浏览器不支持语音输入</TooltipContent>
      </Tooltip>
    );
  }

  const handleClick = () => {
    if (disabled) return;
    if (isListening) {
      stop();
    } else {
      start();
      toast.success("开始语音输入，请说话...", { duration: 1500 });
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={isListening ? "停止语音输入" : "语音输入"}
          className={cn(
            "h-8 w-8 rounded-lg border border-border/40 p-1 transition-colors",
            isListening
              ? "border-red-500/40 bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400"
              : "text-foreground hover:border-border hover:text-foreground",
            disabled && "opacity-50 cursor-not-allowed",
          )}
          data-testid="voice-input-button"
          disabled={disabled}
          onClick={handleClick}
          type="button"
          variant="ghost"
        >
          <MicIcon className={cn("size-3.5", isListening && "animate-pulse")} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isListening
          ? `正在聆听${transcript ? `：${transcript.slice(-20)}` : ""}，点击停止`
          : "语音输入"}
      </TooltipContent>
    </Tooltip>
  );
}

export const VoiceInputButton = PureVoiceInputButton;
