"use client";

/**
 * useAudioRecorder — 音频录音 Hook
 *
 * 封装浏览器 MediaRecorder API，提供录音、停止、获取音频 Blob 的能力。
 * 录音完成后自动调用 ASR 接口转写为文本。
 *
 * 兼容性：
 * - Chrome / Edge / Firefox: 完整支持（audio/webm）
 * - Safari: 部分支持（audio/mp4）
 * - 移动端：iOS Safari 14.3+ 支持
 *
 * 使用方式：
 *   const { isRecording, start, stop, transcript, error } = useAudioRecorder({
 *     onTranscribe: (text) => setInput(text),
 *   });
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export interface UseAudioRecorderOptions {
  /** ASR 识别语言，默认 "zh" */
  language?: string;
  /** 录音时长上限（毫秒），默认 60000（60秒） */
  maxDuration?: number;
  /** 转写失败回调 */
  onError?: (error: string) => void;
  /** 转写成功回调 */
  onTranscribe?: (text: string) => void;
  /** ASR 提示词（指定领域词汇提升准确率） */
  prompt?: string;
}

export interface UseAudioRecorderReturn {
  /** 取消录音（不触发转写） */
  cancel: () => void;
  /** 录音时长（秒） */
  duration: number;
  /** 错误信息 */
  error: string | null;
  /** 是否正在录音 */
  isRecording: boolean;
  /** 是否正在转写 */
  isTranscribing: boolean;
  /** 重置状态 */
  reset: () => void;
  /** 开始录音 */
  start: () => Promise<void>;
  /** 停止录音并触发转写 */
  stop: () => void;
  /** 浏览器是否支持 */
  supported: boolean;
  /** 转写结果 */
  transcript: string;
}

export function useAudioRecorder(
  options: UseAudioRecorderOptions = {}
): UseAudioRecorderReturn {
  const {
    maxDuration = 60_000,
    language = "zh",
    prompt,
    onTranscribe,
    onError,
  } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // 用 ref 保存最新回调
  const onTranscribeRef = useRef(onTranscribe);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onTranscribeRef.current = onTranscribe;
    onErrorRef.current = onError;
  }, [onTranscribe, onError]);

  const supported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "MediaRecorder" in window &&
    !!navigator.mediaDevices?.getUserMedia;

  // 清理资源
  const cleanup = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  // 组件卸载时清理
  useEffect(() => cleanup, [cleanup]);

  // 调用 ASR 接口转写
  const transcribe = useCallback(
    async (audioBlob: Blob) => {
      setIsTranscribing(true);
      setError(null);

      try {
        // 根据录音 MIME 推断文件扩展名
        const ext = audioBlob.type.includes("webm")
          ? "webm"
          : audioBlob.type.includes("mp4")
            ? "m4a"
            : audioBlob.type.includes("wav")
              ? "wav"
              : "webm";
        const filename = `recording-${Date.now()}.${ext}`;

        const formData = new FormData();
        formData.append("file", audioBlob, filename);
        formData.append("language", language);
        if (prompt) {
          formData.append("prompt", prompt);
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/audio/transcribe`,
          {
            method: "POST",
            body: formData,
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          const msg = data.error || `转写失败: ${response.status}`;
          setError(msg);
          onErrorRef.current?.(msg);
          toast.error(msg);
          return;
        }

        const text = data.text as string;
        setTranscript(text);
        onTranscribeRef.current?.(text);
        toast.success(`识别完成（${data.durationMs}ms）`, { duration: 1500 });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "转写请求失败";
        setError(msg);
        onErrorRef.current?.(msg);
        toast.error(msg);
      } finally {
        setIsTranscribing(false);
      }
    },
    [language, prompt]
  );

  const start = useCallback(async () => {
    if (!supported || isRecording) {
      return;
    }

    setError(null);
    setTranscript("");
    setDuration(0);
    chunksRef.current = [];

    try {
      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true, // 回声消除
          noiseSuppression: true, // 噪声抑制
          autoGainControl: true, // 自动增益
        },
      });

      streamRef.current = stream;

      // 选择浏览器支持的 MIME
      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];
      const mimeType = mimeTypes.find((t) => MediaRecorder.isTypeSupported(t));

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType, audioBitsPerSecond: 128_000 } : undefined
      );

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, {
          type: mimeType || "audio/webm",
        });

        cleanup();

        // 录音过短（< 0.5 秒）不转写
        if (audioBlob.size < 1000) {
          toast.error("录音过短，请重新录制");
          return;
        }

        // 触发 ASR 转写
        transcribe(audioBlob).catch((err) => {
          console.error("[useAudioRecorder] transcribe failed:", err);
        });
      };

      recorder.onerror = (event) => {
        const errEvent = event as unknown as { error?: DOMException };
        const msg = errEvent.error?.message || "录音过程出错";
        setError(msg);
        onErrorRef.current?.(msg);
        cleanup();
        setIsRecording(false);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      startTimeRef.current = Date.now();
      setIsRecording(true);

      // 录音时长计时器
      durationTimerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      // 最大时长自动停止
      maxDurationTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
          toast.info("达到最大录音时长（60秒），自动停止");
        }
      }, maxDuration);
    } catch (err) {
      let msg = "无法访问麦克风";
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") {
          msg = "麦克风权限被拒绝，请在浏览器设置中允许";
        } else if (err.name === "NotFoundError") {
          msg = "未检测到麦克风设备";
        } else {
          msg = `麦克风错误: ${err.message}`;
        }
      }
      setError(msg);
      onErrorRef.current?.(msg);
      toast.error(msg);
      cleanup();
    }
  }, [supported, isRecording, maxDuration, cleanup, transcribe]);

  const stop = useCallback(() => {
    if (!mediaRecorderRef.current || !isRecording) {
      return;
    }
    if (mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, [isRecording]);

  const cancel = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      // 移除 onstop 回调，避免触发转写
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    cleanup();
    setIsRecording(false);
    setDuration(0);
  }, [cleanup]);

  const reset = useCallback(() => {
    setTranscript("");
    setError(null);
    setDuration(0);
  }, []);

  return {
    isRecording,
    isTranscribing,
    transcript,
    error,
    supported,
    duration,
    start,
    stop,
    cancel,
    reset,
  };
}
