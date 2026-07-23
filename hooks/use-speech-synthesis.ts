"use client";

/**
 * useSpeechSynthesis — 语音合成（TTS）Hook
 *
 * 封装浏览器 SpeechSynthesis API，提供文本朗读能力。
 *
 * 兼容性：
 * - Chrome / Edge / Safari / Firefox: 均支持（中文语音质量因系统而异）
 * - 移动端：iOS Safari 需用户手势触发
 *
 * 使用方式：
 *   const { speak, stop, speaking, paused, voices } = useSpeechSynthesis({ lang: "zh-CN" });
 *   <button onClick={() => speak("你好世界")}>朗读</button>
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseSpeechSynthesisOptions {
  /** 朗读语言，BCP-47 标签，默认 zh-CN */
  lang?: string;
  /** 语速，0.1-10，默认 1 */
  rate?: number;
  /** 音调，0-2，默认 1 */
  pitch?: number;
  /** 音量，0-1，默认 1 */
  volume?: number;
  /** 朗读开始回调 */
  onStart?: () => void;
  /** 朗读结束回调 */
  onEnd?: () => void;
  /** 朗读错误回调 */
  onError?: (error: string) => void;
}

export interface UseSpeechSynthesisReturn {
  /** 是否正在朗读 */
  speaking: boolean;
  /** 是否暂停 */
  paused: boolean;
  /** 浏览器是否支持 */
  supported: boolean;
  /** 可用语音列表 */
  voices: SpeechSynthesisVoice[];
  /** 当前选中的语音 */
  selectedVoice: SpeechSynthesisVoice | null;
  /** 设置语音 */
  setVoice: (voice: SpeechSynthesisVoice | null) => void;
  /** 朗读文本 */
  speak: (text: string, options?: Partial<Omit<UseSpeechSynthesisOptions, "onStart" | "onEnd" | "onError">>) => void;
  /** 停止朗读 */
  stop: () => void;
  /** 暂停 */
  pause: () => void;
  /** 恢复 */
  resume: () => void;
}

export function useSpeechSynthesis(
  options: UseSpeechSynthesisOptions = {},
): UseSpeechSynthesisReturn {
  const {
    lang: defaultLang = "zh-CN",
    rate: defaultRate = 1,
    pitch: defaultPitch = 1,
    volume: defaultVolume = 1,
    onStart,
    onEnd,
    onError,
  } = options;

  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);
  
  // 回调 ref
  const onStartRef = useRef(onStart);
  const onEndRef = useRef(onEnd);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onStartRef.current = onStart;
    onEndRef.current = onEnd;
    onErrorRef.current = onError;
  }, [onStart, onEnd, onError]);

  // 加载语音列表
  useEffect(() => {
    if (!supported) return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length === 0) return;

      setVoices(availableVoices);

      // 自动选择匹配语言的语音
      setSelectedVoice((prev) => {
        if (prev) return prev;
        const langMatch = availableVoices.find(
          (v) => v.lang === defaultLang || v.lang.startsWith(defaultLang.split("-")[0]),
        );
        return langMatch ?? availableVoices[0] ?? null;
      });
    };

    loadVoices();
    // voices 异步加载，监听 voiceschanged 事件
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, [supported, defaultLang]);

  // 状态同步监听
  useEffect(() => {
    if (!supported) return;

    const handleStart = () => {
      setSpeaking(true);
      setPaused(false);
      onStartRef.current?.();
    };
    const handleEnd = () => {
      setSpeaking(false);
      setPaused(false);
      onEndRef.current?.();
    };
    const handlePause = () => setPaused(true);
    const handleResume = () => setPaused(false);
    const handleError = (event: Event) => {
      const errEvent = event as SpeechSynthesisErrorEvent;
      setSpeaking(false);
      setPaused(false);
      onErrorRef.current?.(errEvent.error);
    };

    window.speechSynthesis.addEventListener("start", handleStart as EventListener);
    window.speechSynthesis.addEventListener("end", handleEnd as EventListener);
    window.speechSynthesis.addEventListener("pause", handlePause as EventListener);
    window.speechSynthesis.addEventListener("resume", handleResume as EventListener);
    window.speechSynthesis.addEventListener("error", handleError as EventListener);

    return () => {
      window.speechSynthesis.removeEventListener("start", handleStart as EventListener);
      window.speechSynthesis.removeEventListener("end", handleEnd as EventListener);
      window.speechSynthesis.removeEventListener("pause", handlePause as EventListener);
      window.speechSynthesis.removeEventListener("resume", handleResume as EventListener);
      window.speechSynthesis.removeEventListener("error", handleError as EventListener);
    };
  }, [supported]);

  // 组件卸载时停止朗读
  useEffect(() => {
    if (!supported) return;
    return () => {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    };
  }, [supported]);

  const speak = useCallback(
    (
      text: string,
      speakOptions?: Partial<
        Omit<UseSpeechSynthesisOptions, "onStart" | "onEnd" | "onError">
      >,
    ) => {
      if (!supported || !text.trim()) return;

      // 取消之前的朗读
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      const lang = speakOptions?.lang ?? defaultLang;
      const rate = speakOptions?.rate ?? defaultRate;
      const pitch = speakOptions?.pitch ?? defaultPitch;
      const volume = speakOptions?.volume ?? defaultVolume;

      utterance.lang = lang;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      // 优先使用选中的语音，否则匹配语言
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      } else {
        const matched = voices.find(
          (v) => v.lang === lang || v.lang.startsWith(lang.split("-")[0]),
        );
        if (matched) utterance.voice = matched;
      }

      window.speechSynthesis.speak(utterance);
    },
    [supported, defaultLang, defaultRate, defaultPitch, defaultVolume, selectedVoice, voices],
  );

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
  }, [supported]);

  const pause = useCallback(() => {
    if (!supported || !speaking) return;
    window.speechSynthesis.pause();
    setPaused(true);
  }, [supported, speaking]);

  const resume = useCallback(() => {
    if (!supported || !paused) return;
    window.speechSynthesis.resume();
    setPaused(false);
  }, [supported, paused]);

  return {
    speaking,
    paused,
    supported,
    voices,
    selectedVoice,
    setVoice: setSelectedVoice,
    speak,
    stop,
    pause,
    resume,
  };
}
