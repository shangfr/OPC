"use client";

/**
 * AudioRecorderButton — 录音转写按钮
 *
 * 集成到 multimodal-input 工具栏，长按/点击录音，
 * 录音结束后自动调用智谱 ASR 转写为文本并填入输入框。
 *
 * 与 VoiceInputButton（实时语音识别）的区别：
 * - VoiceInputButton: Web Speech API，实时识别，依赖浏览器原生支持
 * - AudioRecorderButton: MediaRecorder + 智谱 ASR，录音后转写，兼容性更好
 *
 * 使用 shadcn/ui Button + Tooltip 组件。
 */

import { AudioLinesIcon, Loader2Icon, SquareIcon } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export interface AudioRecorderButtonProps {
  /** 是否禁用 */
  disabled?: boolean;
  /** ASR 识别语言，默认 "zh" */
  language?: string;
  /** 输入框 setter */
  onChange: (value: string) => void;
  /** 当前输入框文本（用于在已有内容后追加） */
  value: string;
}

function PureAudioRecorderButton({
  value,
  onChange,
  language = "zh",
  disabled = false,
}: AudioRecorderButtonProps) {
  const {
    isRecording,
    isTranscribing,
    supported,
    duration,
    error,
    start,
    stop,
    cancel,
  } = useAudioRecorder({
    language,
    maxDuration: 60_000,
    onTranscribe: (text) => {
      // 转写结果追加到输入框末尾
      const base = value.replace(/\s+$/, "");
      onChange(base + (base ? " " : "") + text);
    },
  });

  // 错误提示
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  // 不支持的浏览器
  if (!supported) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex" tabIndex={-1}>
            <Button
              aria-label="录音转写（不支持）"
              className="h-8 w-8 rounded-lg border border-border/40 p-1 text-muted-foreground/30 cursor-not-allowed"
              disabled
              type="button"
              variant="ghost"
            >
              <AudioLinesIcon className="size-3.5 text-muted-foreground/30" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>当前浏览器不支持录音</TooltipContent>
      </Tooltip>
    );
  }

  const handleClick = () => {
    if (disabled || isTranscribing) {
      return;
    }
    if (isRecording) {
      stop();
    } else {
      start().catch((err) =>
        console.error("[audio-recorder] start failed:", err)
      );
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    // 右键取消录音
    e.preventDefault();
    if (isRecording) {
      cancel();
      toast.info("已取消录音");
    }
  };

  // 格式化时长 mm:ss
  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={
            isTranscribing
              ? "正在识别..."
              : isRecording
                ? "停止录音"
                : "录音转写"
          }
          className={cn(
            "h-8 w-8 rounded-lg border border-border/40 p-1 transition-colors relative",
            isRecording
              ? "border-red-500/40 bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400"
              : "text-foreground hover:border-border hover:bg-accent hover:text-foreground",
            (disabled || isTranscribing) && "opacity-50 cursor-not-allowed"
          )}
          data-testid="audio-recorder-button"
          disabled={disabled || isTranscribing}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          type="button"
          variant="ghost"
        >
          {isTranscribing ? (
            <Loader2Icon className="size-3.5 animate-spin text-amber-500" />
          ) : isRecording ? (
            <SquareIcon className="size-3.5 fill-current text-red-600 dark:text-red-400" />
          ) : (
            <AudioLinesIcon className="size-3.5 text-indigo-500" />
          )}

          {/* 录音时长角标 */}
          {isRecording && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-mono px-1 rounded-full leading-tight">
              {formatDuration(duration)}
            </span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isTranscribing
          ? "正在识别语音..."
          : isRecording
            ? `录音中 ${formatDuration(duration)}，点击停止 / 右键取消`
            : "录音转写（最长 60 秒）"}
      </TooltipContent>
    </Tooltip>
  );
}

export const AudioRecorderButton = PureAudioRecorderButton;
