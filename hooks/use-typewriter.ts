"use client";

/**
 * useTypewriter — 匀速打字机渲染队列 Hook
 *
 * 解决大模型 SSE 流式返回的 delta 分片长度不可控、返回节奏不稳定问题。
 *
 * 核心架构：数据层(SSE) → 缓冲层(字符队列) → 渲染层(匀速出队) → 交互层(跳过/终止)
 *
 * 关键设计：
 * - enqueuedLenRef：跟踪已从 text 入队的字符数（防止重复入队）
 * - displayedText：跟踪已渲染显示的文本（由定时器追加）
 * - 两者解耦：text 增长时只入队新增部分，定时器只消费队列
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseTypewriterOptions {
  /** 目标完整文本（持续增长的流式文本） */
  text: string;
  /** 消息 ID，变化时重置队列和已渲染文本 */
  messageId: string;
  /** 是否处于活跃流式状态 */
  isActive: boolean;
  /** 单字符渲染间隔（ms），默认 30ms */
  speed?: number;
  /** 是否启用打字机效果（false 时直接返回完整文本），默认 true */
  enabled?: boolean;
}

export interface UseTypewriterReturn {
  /** 当前已渲染的文本 */
  displayedText: string;
  /** 是否正在打字 */
  isTyping: boolean;
  /** 跳过动画，立即显示全部文本 */
  skip: () => void;
  /** 重置队列和已渲染文本 */
  reset: () => void;
}

export function useTypewriter({
  text,
  messageId,
  isActive,
  speed = 30,
  enabled = true,
}: UseTypewriterOptions): UseTypewriterReturn {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // 队列：待渲染的字符
  const queueRef = useRef<string[]>([]);
  // 已从 text 入队的字符数（关键：防止重复入队）
  const enqueuedLenRef = useRef(0);
  // 定时器
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 是否已跳过
  const skippedRef = useRef(false);
  // 最新 text 的 ref（供 skip 回调使用）
  const textRef = useRef(text);
  // speed ref
  const speedRef = useRef(speed);

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // 停止定时器
  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 重置
  const reset = useCallback(() => {
    stopTimer();
    queueRef.current = [];
    enqueuedLenRef.current = 0;
    skippedRef.current = false;
    setDisplayedText("");
    setIsTyping(false);
  }, [stopTimer]);

  // 跳过动画
  const skip = useCallback(() => {
    skippedRef.current = true;
    stopTimer();
    queueRef.current = [];
    enqueuedLenRef.current = textRef.current.length;
    setDisplayedText(textRef.current);
    setIsTyping(false);
  }, [stopTimer]);

  // 启动渲染循环
  const startTimer = useCallback(() => {
    if (timerRef.current !== null) return;
    setIsTyping(true);
    timerRef.current = setInterval(() => {
      if (skippedRef.current) {
        stopTimer();
        setIsTyping(false);
        return;
      }
      if (queueRef.current.length === 0) {
        stopTimer();
        setIsTyping(false);
        return;
      }
      // 每帧出队一个字符
      const char = queueRef.current.shift();
      if (char !== undefined) {
        setDisplayedText((prev) => prev + char);
      }
    }, speedRef.current);
  }, [stopTimer]);

  // 消息 ID 变化时重置
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageId]);

  // 监听 text 变化，将新增字符入队
  useEffect(() => {
    // 已跳过：直接显示完整文本
    if (skippedRef.current) {
      if (displayedText !== text) {
        enqueuedLenRef.current = text.length;
        setDisplayedText(text);
      }
      return;
    }

    // 未启用打字机：直接显示完整文本
    if (!enabled) {
      enqueuedLenRef.current = text.length;
      queueRef.current = [];
      setDisplayedText(text);
      setIsTyping(false);
      return;
    }

    const currentEnqueued = enqueuedLenRef.current;

    if (text.length > currentEnqueued) {
      // 有新增字符，只入队新增部分
      const newChars = text.slice(currentEnqueued);
      const chars = Array.from(newChars);
      queueRef.current.push(...chars);
      enqueuedLenRef.current = text.length;
    } else if (text.length < currentEnqueued) {
      // 文本被截断或重置（编辑场景）：同步重置
      queueRef.current = [];
      enqueuedLenRef.current = text.length;
      setDisplayedText(text);
      return;
    }

    // 启动定时器（如果尚未运行且有字符待渲染）
    if (queueRef.current.length > 0 && timerRef.current === null) {
      startTimer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, enabled]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      stopTimer();
    };
  }, [stopTimer]);

  return {
    displayedText,
    isTyping,
    skip,
    reset,
  };
}
