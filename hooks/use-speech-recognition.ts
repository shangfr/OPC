"use client";

/**
 * useSpeechRecognition — 语音识别 Hook
 *
 * 封装浏览器 Web Speech API (SpeechRecognition / webkitSpeechRecognition)，
 * 提供受控的语音输入能力。
 *
 * 兼容性：
 * - Chrome / Edge: 完整支持（webkitSpeechRecognition）
 * - Safari: 部分支持（需 HTTPS）
 * - Firefox: 不支持
 *
 * 使用方式：
 *   const { isListening, transcript, start, stop, supported, error } = useSpeechRecognition({
 *     lang: "zh-CN",
 *     onResult: (text) => setInput(text),
 *   });
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ── 类型定义（浏览器原生 API，TS 默认未内置）──
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export interface UseSpeechRecognitionOptions {
  /** 识别语言，BCP-47 标签，默认 zh-CN */
  lang?: string;
  /** 是否连续识别（true=持续监听，false=单次） */
  continuous?: boolean;
  /** 是否返回中间结果 */
  interimResults?: boolean;
  /** 最大候选数 */
  maxAlternatives?: number;
  /** 最终结果回调 */
  onResult?: (transcript: string) => void;
  /** 错误回调 */
  onError?: (error: string) => void;
}

export interface UseSpeechRecognitionReturn {
  /** 是否正在监听 */
  isListening: boolean;
  /** 当前识别文本（实时更新） */
  transcript: string;
  /** 浏览器是否支持 */
  supported: boolean;
  /** 错误信息 */
  error: string | null;
  /** 开始监听 */
  start: () => void;
  /** 停止监听 */
  stop: () => void;
  /** 重置 transcript */
  reset: () => void;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionReturn {
  const {
    lang = "zh-CN",
    continuous = false,
    interimResults = true,
    maxAlternatives = 1,
    onResult,
    onError,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // 用 ref 保存最新回调，避免重建 recognition 实例
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
  }, [onResult, onError]);

  // 浏览器支持检测
  const supported =
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  // 初始化 recognition 实例（仅在 supported 时）
  useEffect(() => {
    if (!supported) return;

    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.maxAlternatives = maxAlternatives;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = "";
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalText += text;
        } else {
          interimText += text;
        }
      }

      if (finalText) {
        setTranscript((prev) => prev + finalText);
        onResultRef.current?.(finalText);
      } else if (interimText) {
        // 中间结果直接覆盖 transcript 末尾，避免重复
        setTranscript((prev) => {
          const base = prev.replace(/\s+$/, "");
          return base + interimText;
        });
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const errorMap: Record<string, string> = {
        "no-speech": "未检测到语音输入",
        "audio-capture": "麦克风访问失败，请检查设备",
        "not-allowed": "麦克风权限被拒绝，请在浏览器设置中允许",
        "service-not-allowed": "语音服务不可用，请使用 HTTPS 或 localhost",
        network: "网络错误，语音服务连接失败",
        aborted: "语音识别已中止",
      };
      const msg = errorMap[event.error] || `语音识别错误: ${event.error}`;
      setError(msg);
      onErrorRef.current?.(event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.onstart = null;
      try {
        recognition.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported, lang, continuous, interimResults, maxAlternatives]);

  const start = useCallback(() => {
    if (!recognitionRef.current || isListening) return;
    try {
      recognitionRef.current.start();
    } catch (err) {
      // 重复 start 会抛 InvalidStateError，忽略
      if (!(err instanceof DOMException && err.name === "InvalidStateError")) {
        setError(err instanceof Error ? err.message : "启动语音识别失败");
      }
    }
  }, [isListening]);

  const stop = useCallback(() => {
    if (!recognitionRef.current || !isListening) return;
    try {
      recognitionRef.current.stop();
    } catch {
      // ignore
    }
    setIsListening(false);
  }, [isListening]);

  const reset = useCallback(() => {
    setTranscript("");
    setError(null);
  }, []);

  return {
    isListening,
    transcript,
    supported,
    error,
    start,
    stop,
    reset,
  };
}
