"use client";

/**
 * useChatNotification — 聊天通知 Hook
 *
 * 监听聊天状态变化，在 Agent 回复完成时（status 从 streaming 变为 ready）
 * 自动发送桌面通知。
 *
 * 配合 NotificationToggle 组件使用：
 * - 用户在 NotificationToggle 中开启通知
 * - 本 hook 检测到回复完成时自动触发通知
 *
 * 使用方式：
 *   useChatNotification({ status, lastMessage, agentName });
 */

import { useEffect, useRef } from "react";
import { useBrowserNotification } from "@/hooks/use-browser-notification";
import { useLocalStorage } from "usehooks-ts";
import { extractMessageText } from "@/lib/chat-utils";
import type { ChatMessage } from "@/lib/types";

export interface UseChatNotificationOptions {
  /** 聊天状态 */
  status: "ready" | "submitted" | "streaming" | "error";
  /** 最后一条 assistant 消息 */
  lastAssistantMessage?: ChatMessage;
  /** Agent 名称（用于通知标题） */
  agentName?: string | null;
}

export function useChatNotification({
  status,
  lastAssistantMessage,
  agentName,
}: UseChatNotificationOptions) {
  const { notify, supported, permission } = useBrowserNotification();
  const [enabled] = useLocalStorage<boolean>("opc-notification-enabled", false);

  // 记录上一次的状态，用于检测 streaming → ready 的转换
  const prevStatusRef = useRef(status);
  // 记录上一次通知的消息 ID，避免重复通知
  const lastNotifiedMessageIdRef = useRef<string | undefined>(undefined);
  // 记录是否在本次会话中曾处于 streaming 状态（避免页面加载时误触发）
  const hasStreamedRef = useRef(false);

  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = status;

    // 标记曾进入 streaming 状态
    if (status === "streaming" || status === "submitted") {
      hasStreamedRef.current = true;
    }

    // 检测 streaming → ready 转换（回复完成）
    const justFinished =
      hasStreamedRef.current &&
      (prevStatus === "streaming" || prevStatus === "submitted") &&
      status === "ready";

    if (!justFinished) return;
    if (!enabled || !supported || permission !== "granted") return;
    if (!lastAssistantMessage) return;

    // 避免对同一条消息重复通知
    if (lastNotifiedMessageIdRef.current === lastAssistantMessage.id) return;
    lastNotifiedMessageIdRef.current = lastAssistantMessage.id;

    const text = extractMessageText(lastAssistantMessage);
    if (!text) return;

    const title = agentName ? `${agentName} 已回复` : "OPC Agent 已回复";
    // 通知正文截取前 100 字符，避免过长
    const body = text.length > 100 ? `${text.slice(0, 100)}...` : text;

    notify(title, {
      body,
      tag: `opc-chat-${lastAssistantMessage.id}`,
      icon: "/icon.png",
    });
  }, [status, lastAssistantMessage, agentName, enabled, supported, permission, notify]);
}
