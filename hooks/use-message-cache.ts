/**
 * In-memory message cache with LRU eviction.
 * Survives React re-mounts and SPA navigation for instant chat switching.
 * Cleared on hard refresh — SWR re-fetches from API in that case.
 */
import type { ChatMessage } from "@/lib/types";

export interface ChatCacheEntry {
  messages: ChatMessage[];
  agentId: string | null;
  visibility: string;
  title?: string;
  agentName?: string | null;
}

const MAX_CACHE_SIZE = 50;
const messageCache = new Map<string, ChatCacheEntry>();

function evictIfNeeded(): void {
  while (messageCache.size > MAX_CACHE_SIZE) {
    const oldestKey = messageCache.keys().next().value;
    if (oldestKey !== undefined) {
      messageCache.delete(oldestKey);
    } else {
      break;
    }
  }
}

export function getChatCache(chatId: string): ChatCacheEntry | undefined {
  const entry = messageCache.get(chatId);
  if (entry) {
    // Move to end (most recently used) on read
    messageCache.delete(chatId);
    messageCache.set(chatId, entry);
  }
  return entry;
}

export function setChatCache(chatId: string, entry: ChatCacheEntry): void {
  // Delete first to re-insert at end (Map preserves insertion order)
  messageCache.delete(chatId);
  evictIfNeeded();
  messageCache.set(chatId, entry);
}

export function updateChatMessages(
  chatId: string,
  messages: ChatMessage[]
): void {
  const existing = messageCache.get(chatId);
  messageCache.delete(chatId);
  evictIfNeeded();
  messageCache.set(chatId, {
    messages,
    agentId: existing?.agentId ?? null,
    visibility: existing?.visibility ?? "private",
    title: existing?.title,
    agentName: existing?.agentName,
  });
}

export function hasChatCache(chatId: string): boolean {
  return messageCache.has(chatId);
}

export function clearChatCache(chatId?: string): void {
  if (chatId) {
    messageCache.delete(chatId);
  } else {
    messageCache.clear();
  }
}
