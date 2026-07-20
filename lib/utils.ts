import type {
  UIMessage,
  UIMessagePart,
} from 'ai';
import { type ClassValue, clsx } from 'clsx';
import { formatISO } from 'date-fns';
import { twMerge } from 'tailwind-merge';
import type { DBMessage, Document } from '@/lib/db/schema';
import { ChatbotError, type ErrorCode } from './errors';
import type { ChatMessage, ChatTools, CustomUIDataTypes } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    const { code, cause } = await response.json();
    throw new ChatbotError(code as ErrorCode, cause);
  }

  return response.json();
};

export async function fetchWithErrorHandlers(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  try {
    const response = await fetch(input, init);

    if (!response.ok) {
      const { code, cause } = await response.json();
      throw new ChatbotError(code as ErrorCode, cause);
    }

    return response;
  } catch (error: unknown) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new ChatbotError('offline:chat');
    }

    throw error;
  }
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getDocumentTimestampByIndex(
  documents: Document[],
  index: number,
) {
  if (!documents) { return new Date(); }
  if (index > documents.length) { return new Date(); }

  return documents[index].createdAt;
}

export function sanitizeText(text: string) {
  return text.replace('<has_function_call>', '');
}

/**
 * 带超时的 fetch 封装
 */
export async function fetchWithTimeout(
  input: string | URL | Request,
  init: RequestInit = {},
  timeoutMs = 10_000,
): Promise<Response> {
  if (init.signal) {
    return fetch(input, init);
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`请求超时（${timeoutMs}ms）: ${input.toString().slice(0, 100)}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function convertToUIMessages(messages: DBMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role as 'user' | 'assistant' | 'system',
    parts: message.parts as UIMessagePart<CustomUIDataTypes, ChatTools>[],
    metadata: {
      createdAt: formatISO(message.createdAt),
    },
  }));
}

export function getTextFromMessage(message: ChatMessage | UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => (part as { type: 'text'; text: string}).text)
    .join('');
}

export function isAdmin(user: { role?: string | null }): boolean {
  return user.role === 'admin';
}

export function hasPermission(
  user: { role?: string | null } | null,
  requiredRole: 'user' | 'admin'
): boolean {
  if (!user?.role) return false;

  const roleHierarchy = {
    user: 0,
    admin: 1,
  };

  const userLevel = roleHierarchy[user.role as keyof typeof roleHierarchy] ?? 0;
  const requiredLevel = roleHierarchy[requiredRole];

  return userLevel >= requiredLevel;
}

// ── 安全的 sessionStorage/localStorage 工具函数 ──
// 隐私模式或 storage 被禁用时，直接调用 sessionStorage 会抛异常
// 这些函数静默处理错误，返回 null/undefined 而非崩溃

export function safeSessionStorageGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSessionStorageSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // 静默忽略（隐私模式或 storage 已满）
  }
}

export function safeSessionStorageRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // 静默忽略
  }
}
