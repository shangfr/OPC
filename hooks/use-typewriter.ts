"use client";

/**
 * useTypewriter — 自适应打字机渲染队列 Hook
 *
 * 解决大模型 SSE 流式返回的 delta 分片长度不可控、返回节奏不稳定问题。
 *
 * 核心架构：数据层(SSE) → 缓冲层(字符队列) → 渲染层(rAF 自适应出队) → 交互层(跳过/终止)
 *
 * 关键改进（v2）：
 * - 使用 requestAnimationFrame 替代 setInterval，与浏览器渲染周期同步，消除卡顿
 * - 自适应批量出队：队列积压时每帧多出字符，队列短时保持逐字效果
 * - 最低速度保底：每帧至少出 1 字符（~60 chars/s），确保短回复也有打字感
 * - 追赶机制：流结束后若队列仍有大量待渲染字符，自动加速直到完成
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseTypewriterOptions {
  /** 目标完整文本（持续增长的流式文本） */
  text: string;
  /** 消息 ID，变化时重置队列和已渲染文本 */
  messageId: string;
  /** 是否处于活跃流式状态 */
  isActive: boolean;
  /** 基础单字符渲染间隔（ms），默认 16ms（约每帧 1 字符），默认 16 */
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
  speed = 16,
  enabled = true,
}: UseTypewriterOptions): UseTypewriterReturn {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // 队列和渲染状态用 ref，避免重渲染
  const queueRef = useRef<string[]>([]);
  const enqueuedLenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number>(0);
  const accumulatorRef = useRef<number>(0);
  const isActiveRef = useRef(isActive);
  const speedRef = useRef(speed);

  const messageIdRef = useRef(messageId);

  // keep isActiveRef in sync
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // keep speedRef in sync
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // messageId 变化时重置所有状态
  useEffect(() => {
    if (messageIdRef.current !== messageId) {
      messageIdRef.current = messageId;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      queueRef.current = [];
      enqueuedLenRef.current = 0;
      accumulatorRef.current = 0;
      setDisplayedText("");
      setIsTyping(false);
    }
  }, [messageId]);

  const flushImmediately = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    // 将队列中所有字符一次性输出
    const remaining = queueRef.current.join("");
    queueRef.current = [];
    enqueuedLenRef.current = text.length;
    setDisplayedText((prev) => prev + remaining);
    setIsTyping(false);
  }, [text]);

  const skip = useCallback(() => {
    flushImmediately();
  }, [flushImmediately]);

  const reset = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    queueRef.current = [];
    enqueuedLenRef.current = 0;
    accumulatorRef.current = 0;
    setDisplayedText("");
    setIsTyping(false);
  }, []);

  const tick = useCallback(
    (timestamp: number) => {
      if (queueRef.current.length === 0) {
        // 队列空了，检查是否应该停止
        if (!isActiveRef.current) {
          setIsTyping(false);
          rafRef.current = null;
          return;
        }
        // 仍在流式但暂时没新字符，继续等
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // 计算这一帧应该出多少字符
      // 策略：
      // - 累加时间，每 speedRef.current ms 出 1 字符（基础速率）
      // - 但如果队列积压超过阈值，加速追赶
      const queueLen = queueRef.current.length;
      let charsToEmit = 0;

      if (lastTickTimeRef.current === 0) {
        lastTickTimeRef.current = timestamp;
      }

      const deltaMs = timestamp - lastTickTimeRef.current;
      lastTickTimeRef.current = timestamp;

      // 基础累加器：按 speedRef.current ms/字符的速率积累
      accumulatorRef.current += deltaMs;

      // 基础出队量
      const baseChars = Math.floor(accumulatorRef.current / speedRef.current);
      accumulatorRef.current -= baseChars * speedRef.current;

      // 自适应加速：队列越长，每帧额外多出字符
      // 当队列 < 20 字符时，保持逐字效果（baseChars，通常 1）
      // 当队列 20-100 字符时，额外出 2-5 字符
      // 当队列 > 100 字符时，额外出更多（追赶模式）
      let extraChars = 0;
      if (queueLen > 20) {
        // 额外按队列长度的 10% 出字符，最少 2
        extraChars = Math.max(2, Math.floor(queueLen * 0.1));
      }
      // 如果流已结束但队列仍有大量字符，强力追赶
      if (!isActiveRef.current && queueLen > 50) {
        extraChars = Math.max(extraChars, Math.floor(queueLen * 0.2));
      }

      charsToEmit = baseChars + extraChars;
      if (charsToEmit < 1) charsToEmit = 1; // 保底每帧至少 1 字符

      // 从队列头部取字符
      const emitted = queueRef.current.splice(0, charsToEmit);
      const emittedText = emitted.join("");

      setDisplayedText((prev) => prev + emittedText);

      // 继续下一帧
      rafRef.current = requestAnimationFrame(tick);
    },
    []
  );

  // 当 text 或 messageId 变化时入队新字符
  useEffect(() => {
    if (!enabled) {
      setDisplayedText(text);
      queueRef.current = [];
      enqueuedLenRef.current = text.length;
      setIsTyping(false);
      return;
    }

    // messageId 变化时重置
    const currentEnqueued = enqueuedLenRef.current;

    if (text.length > currentEnqueued) {
      // 有新增字符，入队
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

    // 启动 rAF（如果尚未运行）
    if (queueRef.current.length > 0 && rafRef.current === null) {
      lastTickTimeRef.current = 0;
      setIsTyping(true);
      rafRef.current = requestAnimationFrame(tick);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, enabled]);

  // 流式状态变化
  useEffect(() => {
    if (!isActive && queueRef.current.length === 0 && rafRef.current !== null) {
      // 流结束且队列空，停止
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setIsTyping(false);
    } else if (isActive && rafRef.current === null && queueRef.current.length > 0) {
      // 流开始且有队列，启动
      lastTickTimeRef.current = 0;
      setIsTyping(true);
      rafRef.current = requestAnimationFrame(tick);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return {
    displayedText,
    isTyping,
    skip,
    reset,
  };
}
