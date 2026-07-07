/**
 * 聊天相关工具函数
 * - 消息字数 / Token 估算
 * - 对话导出为 Markdown
 *
 * 这些函数为纯前端逻辑，不依赖数据库结构，便于在 OPC 场景下
 * 进行成本感知与知识沉淀。
 */

import type { ChatMessage } from "@/lib/types";

/**
 * 从消息中安全提取创建时间。
 * AI SDK v5 的 UIMessage 通过 metadata 传递 createdAt，
 * 这里兼容 metadata.createdAt（字符串）与可能的 Date 类型。
 */
function getMessageCreatedAt(message: ChatMessage): string | Date | undefined {
  const meta = message.metadata as Record<string, unknown> | undefined;
  return meta?.createdAt as string | Date | undefined;
}

/**
 * 估算字符数（中英文混合场景下，按"字符"而非"单词"统计更直观）。
 * 去除空白字符后计数，避免 Markdown 语法符号干扰。
 */
export function estimateCharCount(text: string): number {
  if (!text) return 0;
  // 去除所有空白字符后统计
  return text.replace(/\s+/g, "").length;
}

/**
 * 粗略估算 Token 数。
 * 经验值：中文约 1 字 ≈ 1.5 token，英文约 4 字符 ≈ 1 token。
 * 这里采用混合估算：中文字符数 × 1.5 + 英文单词数 × 1.3。
 * 仅用于成本感知参考，非精确值。
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  // 中文字符（含全角标点）
  const cjkChars = (text.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length;
  // 非中文字符（按单词计）
  const nonCjkText = text.replace(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g, " ");
  const words = nonCjkText.trim().split(/\s+/).filter(Boolean).length;
  return Math.round(cjkChars * 1.5 + words * 1.3);
}

/**
 * 从消息 parts 中提取纯文本内容。
 */
export function extractMessageText(message: ChatMessage): string {
  if (!message.parts) return "";
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

/**
 * 将字数格式化为简短显示字符串。
 * 例如：1234 -> "1.2k"
 */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1)}k`;
}

/**
 * 将一组消息导出为 Markdown 字符串。
 *
 * 格式说明：
 * - 顶部包含对话元信息（导出时间、消息数、总字数）
 * - 每条消息以 "## 角色" 作为标题
 * - 用户消息标记为 "🧑 用户"，助手消息标记为 "🤖 助手"
 * - 保留消息原文（含 Markdown 格式）
 *
 * @param messages 消息列表
 * @param options 可选元信息：标题、Agent 名称
 */
export function exportMessagesToMarkdown(
  messages: ChatMessage[],
  options?: { title?: string; agentName?: string | null },
): string {
  const now = new Date();
  const lines: string[] = [];

  const title = options?.title || "对话记录";
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`> 导出时间：${now.toLocaleString("zh-CN")}`);
  if (options?.agentName) {
    lines.push(`> 关联 Agent：${options.agentName}`);
  }
  lines.push(`> 消息数量：${messages.length}`);

  // 统计总字数
  const totalChars = messages.reduce(
    (sum, m) => sum + estimateCharCount(extractMessageText(m)),
    0,
  );
  const totalTokens = messages.reduce(
    (sum, m) => sum + estimateTokenCount(extractMessageText(m)),
    0,
  );
  lines.push(`> 总字数：${totalChars}（约 ${totalTokens} tokens）`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const message of messages) {
    const role = message.role === "user" ? "🧑 用户" : "🤖 助手";
    const rawTime = getMessageCreatedAt(message);
    const time = rawTime ? new Date(rawTime).toLocaleString("zh-CN") : "";
    lines.push(`## ${role}${time ? `  ·  ${time}` : ""}`);
    lines.push("");
    const text = extractMessageText(message);
    if (text) {
      lines.push(text);
    } else {
      lines.push("_(非文本消息)_");
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * 触发浏览器下载文本文件。
 */
export function downloadTextFile(
  content: string,
  filename: string,
  mimeType = "text/markdown;charset=utf-8",
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 释放对象 URL，避免内存泄漏
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 将文件名中的非法字符替换为下划线，确保跨平台兼容。
 */
export function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
}
