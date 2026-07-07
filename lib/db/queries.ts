import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  sum,
  type SQL,
  sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { ArtifactKind } from "@/components/chat/artifact";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import { ChatbotError } from "../errors";
import { generateUUID } from "../utils";
import {
  agent,
  type Chat,
  category,
  chat,
  type DBMessage,
  document,
  message,
  passwordResetToken,
  phoneVerificationCode,
  type Suggestion,
  siteConfig,
  stream,
  suggestion,
  ticket,
  ticketActivity,
  type TicketActivity,
  ticketCategory,
  ticketComment,
  type TicketComment,
  type TicketCategory,
  ticketTag,
  ticketTagRelation,
  type TicketTag,
  type Ticket,
  type User,
  user,
  userKnowledge,
  vote,
  // SaaS 多租户表
  team,
  type Team,
  teamMember,
  type TeamMember,
  invitation,
  type Invitation,
  activityLog,
  type ActivityLog,
  type TeamDataWithMembers,
  // OPC 交易市场表
  enterprise,
  type Enterprise,
  opcListingApplication,
  type OpcListingApplication,
  opcOrder,
  type OpcOrder,
  opcSubscription,
  type OpcSubscription,
  opcRevenue,
  type OpcRevenue,
} from "./schema";
import { generateHashedPassword } from "./utils";

const client = postgres(process.env.POSTGRES_URL ?? "");
export const db = drizzle(client);

export async function getUser(email: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get user by email"
    );
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to create user");
  }
}

// ===== 手机号注册登录相关查询 =====

/** 通过手机号查询用户 */
export async function getUserByPhone(phone: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.phone, phone));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get user by phone"
    );
  }
}

/** 通过手机号创建用户（邮箱使用 phone@phone 占位，后续可补充） */
export async function createUserByPhone(phone: string, name?: string) {
  try {
    // 邮箱字段 NOT NULL，使用 phone_xxx@phone.local 占位
    const placeholderEmail = `phone_${phone}@phone.local`;
    return await db
      .insert(user)
      .values({
        email: placeholderEmail,
        phone,
        name: name ?? `用户${phone.slice(-4)}`,
        emailVerified: true, // 手机号已验证
      })
      .returning({
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        role: user.role,
      });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create user by phone"
    );
  }
}

/** 创建手机号验证码记录 */
export async function createPhoneVerificationCode(
  phone: string,
  code: string,
  purpose: "register" | "login"
) {
  try {
    // 验证码有效期 5 分钟
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    return await db
      .insert(phoneVerificationCode)
      .values({ phone, code, purpose, expiresAt })
      .returning({ id: phoneVerificationCode.id });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create verification code"
    );
  }
}

/** 校验手机号验证码（同时检查有效期、用途、是否已使用） */
export async function verifyPhoneCode(
  phone: string,
  code: string,
  purpose: "register" | "login"
): Promise<boolean> {
  try {
    const now = new Date();
    const records = await db
      .select()
      .from(phoneVerificationCode)
      .where(
        and(
          eq(phoneVerificationCode.phone, phone),
          eq(phoneVerificationCode.code, code),
          eq(phoneVerificationCode.purpose, purpose),
          isNull(phoneVerificationCode.usedAt),
          gt(phoneVerificationCode.expiresAt, now)
        )
      )
      .orderBy(desc(phoneVerificationCode.createdAt))
      .limit(1);

    if (records.length === 0) {
      return false;
    }

    // 标记为已使用
    await db
      .update(phoneVerificationCode)
      .set({ usedAt: now })
      .where(eq(phoneVerificationCode.id, records[0].id));

    return true;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to verify phone code"
    );
  }
}

/** 检查手机号在最近 N 分钟内发送验证码的次数（用于限流） */
export async function countRecentPhoneCodes(
  phone: string,
  withinMinutes = 60
): Promise<number> {
  try {
    const since = new Date(Date.now() - withinMinutes * 60 * 1000);
    const result = await db
      .select({ count: count() })
      .from(phoneVerificationCode)
      .where(
        and(
          eq(phoneVerificationCode.phone, phone),
          gt(phoneVerificationCode.createdAt, since)
        )
      );
    return result[0]?.count ?? 0;
  } catch (_error) {
    return 0;
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    return await db.insert(user).values({ 
      email, 
      password,
      isAnonymous: true,
    }).returning({
      id: user.id,
      email: user.email,
    });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create guest user"
    );
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
  agentId,
  agentName,
  teamId,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
  agentId?: string | null;
  agentName?: string | null;
  // SaaS 多租户：所属团队 ID（用于租户隔离）
  teamId?: string | null;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
      agentId: agentId ?? null,
      agentName: agentName ?? null,
      teamId: teamId ?? null,
    });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save chat");
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    return await db.transaction(async (tx) => {
      await tx.delete(vote).where(eq(vote.chatId, id));
      await tx.delete(message).where(eq(message.chatId, id));
      await tx.delete(stream).where(eq(stream.chatId, id));

      const [chatsDeleted] = await tx
        .delete(chat)
        .where(eq(chat.id, id))
        .returning();
      return chatsDeleted;
    });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete chat by id"
    );
  }
}

export async function deleteAllChatsByUserId({ userId }: { userId: string }) {
  try {
    return await db.transaction(async (tx) => {
      const userChats = await tx
        .select({ id: chat.id })
        .from(chat)
        .where(eq(chat.userId, userId));

      if (userChats.length === 0) {
        return { deletedCount: 0 };
      }

      const chatIds = userChats.map((c) => c.id);

      await tx.delete(vote).where(inArray(vote.chatId, chatIds));
      await tx.delete(message).where(inArray(message.chatId, chatIds));
      await tx.delete(stream).where(inArray(stream.chatId, chatIds));

      const deletedChats = await tx
        .delete(chat)
        .where(eq(chat.userId, userId))
        .returning();

      return { deletedCount: deletedChats.length };
    });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete all chats by user id"
    );
  }
}

export async function updateChatPinnedById({
  chatId,
  pinnedAt,
}: {
  chatId: string;
  pinnedAt: Date | null;
}) {
  try {
    return await db
      .update(chat)
      .set({ pinnedAt })
      .where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update chat pinned status"
    );
  }
}

export async function deleteChatsByIds({
  ids,
  userId,
}: {
  ids: string[];
  userId: string;
}) {
  try {
    return await db.transaction(async (tx) => {
      const userChats = await tx
        .select({ id: chat.id })
        .from(chat)
        .where(and(eq(chat.userId, userId), inArray(chat.id, ids)));

      if (userChats.length === 0) {
        return { deletedCount: 0 };
      }

      const chatIds = userChats.map((c) => c.id);

      await tx.delete(vote).where(inArray(vote.chatId, chatIds));
      await tx.delete(message).where(inArray(message.chatId, chatIds));
      await tx.delete(stream).where(inArray(stream.chatId, chatIds));

      const deletedChats = await tx
        .delete(chat)
        .where(and(eq(chat.userId, userId), inArray(chat.id, chatIds)))
        .returning();

      return { deletedCount: deletedChats.length };
    });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete chats by ids"
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
  teamId,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
  // SaaS 多租户：按团队过滤（传入则只返回该团队的对话，实现租户隔离）
  teamId?: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    // SaaS：在原有 userId 过滤基础上叠加 teamId 过滤
    const teamCondition = teamId ? eq(chat.teamId, teamId) : undefined;

    const baseQuery = (whereCondition?: SQL<unknown>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? teamCondition
              ? and(whereCondition, eq(chat.userId, id), teamCondition)
              : and(whereCondition, eq(chat.userId, id))
            : teamCondition
              ? and(eq(chat.userId, id), teamCondition)
              : eq(chat.userId, id)
        )
        .orderBy(sql`${chat.pinnedAt} DESC NULLS LAST`, desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Chat[] = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatbotError(
          "not_found:database",
          `Chat with id ${startingAfter} not found`
        );
      }

      filteredChats = await baseQuery(
        gt(chat.createdAt, selectedChat.createdAt)
      );
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatbotError(
          "not_found:database",
          `Chat with id ${endingBefore} not found`
        );
      }

      filteredChats = await baseQuery(
        lt(chat.createdAt, selectedChat.createdAt)
      );
    } else {
      filteredChats = await baseQuery();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get chats by user id"
    );
  }
}

export async function getPinnedChatsByUserId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(chat)
      .where(
        and(
          eq(chat.userId, id),
          sql`${chat.pinnedAt} IS NOT NULL`
        )
      )
      .orderBy(desc(chat.pinnedAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get pinned chats"
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get chat by id");
  }
}

export async function getChatWithAgent({ id }: { id: string }) {
  try {
    const [row] = await db.select().from(chat).where(eq(chat.id, id));
    if (!row) return null;
    return row;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get chat with agent"
    );
  }
}

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    return await db
      .insert(message)
      .values(messages)
      .onConflictDoUpdate({
        target: message.id,
        set: { parts: sql`excluded.parts` },
      });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save messages");
  }
}

export async function updateMessage({
  id,
  parts,
}: {
  id: string;
  parts: DBMessage["parts"];
}) {
  try {
    return await db.update(message).set({ parts }).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to update message");
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get messages by chat id"
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === "up" })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === "up",
    });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to vote message");
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get votes by chat id"
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
  chatId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
  chatId: string;
}) {
  try {
    return await db
      .insert(document)
      .values({
        id,
        title,
        kind,
        content,
        userId,
        chatId,
        createdAt: new Date(),
      })
      .returning();
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save document");
  }
}

export async function updateDocumentContent({
  id,
  content,
}: {
  id: string;
  content: string;
}) {
  try {
    const docs = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt))
      .limit(1);

    const latest = docs[0];
    if (!latest) {
      throw new ChatbotError("not_found:database", "Document not found");
    }

    return await db
      .update(document)
      .set({ content })
      .where(and(eq(document.id, id), eq(document.createdAt, latest.createdAt)))
      .returning();
  } catch (_error) {
    if (_error instanceof ChatbotError) {
      throw _error;
    }
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update document content"
    );
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get documents by id"
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get document by id"
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp)
        )
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete documents by id after timestamp"
    );
  }
}

export async function getDocumentsByUserId({ userId }: { userId: string }) {
  try {
    return await db
      .select({
        id: document.id,
        title: document.title,
        kind: document.kind,
        content: document.content,
        chatId: document.chatId,
        createdAt: document.createdAt,
      })
      .from(document)
      .where(eq(document.userId, userId))
      .orderBy(desc(document.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get documents by user"
    );
  }
}

export async function deleteDocumentById({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  try {
    return await db
      .delete(document)
      .where(and(eq(document.id, id), eq(document.userId, userId)))
      .returning();
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete document"
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to save suggestions"
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(eq(suggestion.documentId, documentId));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get suggestions by document id"
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get message by id"
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))
      );

    const messageIds = messagesToDelete.map(
      (currentMessage) => currentMessage.id
    );

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds))
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds))
        );
    }
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete messages by chat id after timestamp"
    );
  }
}

export async function updateChatVisibilityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update chat visibility by id"
    );
  }
}

export async function updateChatTitleById({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}) {
  try {
    return await db.update(chat).set({ title }).where(eq(chat.id, chatId));
  } catch (_error) {
    return;
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const cutoffTime = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, cutoffTime),
          eq(message.role, "user")
        )
      )
      .execute();

    return stats?.count ?? 0;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get message count by user id"
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create stream id"
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get stream ids by chat id"
    );
  }
}

// ============================================================
// Agent CRUD
// ============================================================

export async function getAgents() {
  try {
    return await db
      .select()
      .from(agent)
      .orderBy(asc(agent.sortOrder), desc(agent.createdAt));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get agents");
  }
}

/**
 * 统计每个 Agent 关联的对话数量。
 *
 * 通过对 chat 表按 agentId 分组计数实现，不修改任何表结构。
 * 用于在 Agent 卡片上展示使用热度，帮助 OPC 用户识别高频使用的 Agent。
 * 仅统计 agentId 非空的对话。
 *
 * @returns Record<agentId, chatCount>
 */
export async function getAgentChatCounts(): Promise<Record<string, number>> {
  try {
    const rows = await db
      .select({
        agentId: chat.agentId,
        chatCount: count(),
      })
      .from(chat)
      .where(sql`${chat.agentId} IS NOT NULL`)
      .groupBy(chat.agentId);

    const result: Record<string, number> = {};
    for (const row of rows) {
      if (row.agentId) {
        result[row.agentId] = row.chatCount;
      }
    }
    return result;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get agent chat counts",
    );
  }
}

// ── Agent cache (5-min TTL, invalidated on CRUD mutations) ──
const agentCache = new Map<string, { data: unknown; ts: number }>();
const AGENT_CACHE_TTL = 5 * 60 * 1000;

export function invalidateAgentCache(id: string): void {
  agentCache.delete(id);
}

export async function getAgentById({ id }: { id: string }) {
  const cached = agentCache.get(id);
  if (cached && Date.now() - cached.ts < AGENT_CACHE_TTL) {
    return cached.data as Awaited<ReturnType<typeof getAgentByIdFromDb>>;
  }
  const result = await getAgentByIdFromDb({ id });
  if (result) {
    agentCache.set(id, { data: result, ts: Date.now() });
  }
  return result;
}

async function getAgentByIdFromDb({ id }: { id: string }) {
  try {
    const [result] = await db.select().from(agent).where(eq(agent.id, id));
    return result ?? null;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get agent by id");
  }
}

export async function createAgent({
  name,
  description,
  avatar,
  systemPrompt,
  phone,
  knowledgeId,
  starterQuestions,
  isActive,
  isDefault,
  sortOrder,
  categoryId,
  userId,
  visibility = "public",
  teamId,
  // OPC 交易市场：所有权参数
  ownershipType = "personal_private",
  ownerType = "user",
  ownerEnterpriseId,
  priceMonthly = 0,
  priceYearly = 0,
}: {
  name: string;
  description: string;
  avatar: string;
  systemPrompt: string;
  phone?: string | null;
  knowledgeId?: string | null;
  starterQuestions?: string[];
  isActive: boolean;
  isDefault?: boolean;
  sortOrder: number;
  categoryId?: string | null;
  userId: string;
  visibility?: "public" | "private";
  // SaaS 多租户：private Agent 归属的团队 ID
  teamId?: string | null;
  // OPC 交易市场：所有权类型 / 所有者主体 / 所属企业 / 订阅价格
  ownershipType?: "personal_private" | "enterprise_private" | "public";
  ownerType?: "user" | "enterprise" | "platform";
  ownerEnterpriseId?: string | null;
  priceMonthly?: number;
  priceYearly?: number;
}) {
  try {
    if (isDefault === true) {
      const [result] = await db.transaction(async (tx) => {
        await tx
          .update(agent)
          .set({ isDefault: false })
          .where(eq(agent.isDefault, true));

        const [created] = await tx
          .insert(agent)
          .values({
            name,
            description,
            avatar,
            systemPrompt,
            phone: phone || null,
            knowledgeId: knowledgeId ?? null,
            starterQuestions: starterQuestions ?? [],
            isActive,
            isDefault: true,
            sortOrder,
            categoryId: categoryId ?? null,
            userId,
            visibility,
            teamId: teamId ?? null,
            // OPC 交易市场：所有权字段
            ownershipType,
            ownerType,
            ownerEnterpriseId: ownerEnterpriseId ?? null,
            listingStatus: "private",
            priceMonthly,
            priceYearly,
          })
          .returning();

        return [created];
      });
      return result;
    }

    const [result] = await db
      .insert(agent)
      .values({
        name,
        description,
        avatar,
        systemPrompt,
        phone: phone || null,
        knowledgeId: knowledgeId ?? null,
        starterQuestions: starterQuestions ?? [],
        isActive,
        isDefault: false,
        sortOrder,
        categoryId: categoryId ?? null,
        userId,
        visibility,
        teamId: teamId ?? null,
        // OPC 交易市场：所有权字段
        ownershipType,
        ownerType,
        ownerEnterpriseId: ownerEnterpriseId ?? null,
        listingStatus: "private",
        priceMonthly,
        priceYearly,
      })
      .returning();
    return result;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to create agent");
  }
}

/**
 * 获取用户自建的 OPC 列表（包含所有上架状态：私有/审核中/已上架/已下架）。
 * 用户可在「我的 OPC」中查看每个 OPC 的当前上架状态。
 */
export async function getAgentsByUserId({ userId }: { userId: string }) {
  try {
    return await db
      .select()
      .from(agent)
      .where(eq(agent.userId, userId))
      .orderBy(desc(agent.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get agents by user"
    );
  }
}

/** 获取所有可见的 OPC：公共 OPC + 用户自建的 private OPC（SaaS：按团队隔离 private OPC） */
/**
 * 获取当前用户可见的 OPC（三态所有权模型）。
 *
 * 可见性规则：
 * - 个人账号（personal）：
 *   ① 自己创建的个人私有 OPC（ownershipType=personal_private, userId=当前用户）
 *   ② 全部已上架公共 OPC（listingStatus=listed）—— 仅浏览，使用需企业订阅
 * - 企业账号（enterprise）：
 *   ① 本企业私有 OPC（ownershipType=enterprise_private, ownerEnterpriseId=当前企业）
 *   ② 本企业已订阅的公共 OPC（opcSubscription 中 active 记录）
 *   ③ 全部已上架公共 OPC（listingStatus=listed）—— 浏览
 *
 * @param userId 当前用户 ID
 * @param teamId 团队 ID（保留兼容旧逻辑）
 * @param accountType 账号类型 personal/enterprise
 * @param enterpriseId 企业账号所属企业 ID
 */
/**
 * 获取用户在指定团队中的角色。
 * 返回 "owner" | "admin" | "member" | null（null 表示非团队成员）
 */
export async function getUserTeamRole(
  userId: string,
  teamId: string
): Promise<"owner" | "admin" | "member" | null> {
  try {
    const [row] = await db
      .select({ role: teamMember.role })
      .from(teamMember)
      .where(
        and(
          eq(teamMember.userId, userId),
          eq(teamMember.teamId, teamId)
        )
      )
      .limit(1);
    return row?.role ?? null;
  } catch {
    return null;
  }
}

/**
 * 获取团队成员列表（供企业管理员用户管理页面使用）。
 * 返回团队成员及其账号信息。
 */
export async function getTeamMembersForAdmin(teamId: string) {
  try {
    const rows = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        accountType: user.accountType,
        enterpriseId: user.enterpriseId,
        role: user.role,
        phone: user.phone,
        bannedAt: user.bannedAt,
        bannedReason: user.bannedReason,
        createdAt: user.createdAt,
        teamRole: teamMember.role,
        joinedAt: teamMember.createdAt,
      })
      .from(teamMember)
      .innerJoin(user, eq(user.id, teamMember.userId))
      .where(eq(teamMember.teamId, teamId))
      .orderBy(desc(teamMember.createdAt));

    return rows;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get team members"
    );
  }
}

/**
 * 获取团队创建的全部 OPC（供企业管理员 OPC 管理页面使用）。
 * 包括 enterprise_private 和已上架的 public OPC（属于该企业的）。
 */
export async function getTeamOpcs(teamId: string) {
  try {
    return await db
      .select()
      .from(agent)
      .where(eq(agent.teamId, teamId))
      .orderBy(desc(agent.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get team OPCs"
    );
  }
}

/**
 * 获取企业已订阅的公共 OPC 列表（含订阅信息 + 副本 agent）。
 * 用于企业管理员 /admin/opcs 页面管理已订阅 OPC。
 */
export async function getSubscribedOpcs(enterpriseId: string) {
  try {
    const rows = await db
      .select({
        agent: agent,
        subscription: opcSubscription,
      })
      .from(opcSubscription)
      .innerJoin(agent, eq(agent.id, opcSubscription.agentId))
      .where(
        and(
          eq(opcSubscription.enterpriseId, enterpriseId),
          eq(opcSubscription.status, "active")
        )
      )
      .orderBy(desc(opcSubscription.createdAt));

    // 查询副本 agent
    const clonedIds = rows
      .map((r) => r.subscription.clonedAgentId)
      .filter((id): id is string => id !== null);
    const clonedAgents = clonedIds.length > 0
      ? await db.select().from(agent).where(inArray(agent.id, clonedIds))
      : [];
    const clonedMap = new Map(clonedAgents.map((a) => [a.id, a]));

    return rows.map((r) => ({
      ...r,
      clonedAgent: r.subscription.clonedAgentId
        ? clonedMap.get(r.subscription.clonedAgentId) ?? null
        : null,
    }));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get subscribed OPCs"
    );
  }
}

/**
 * 取消订阅（企业管理员操作）。
 * 将订阅状态改为 canceled，不允许再次使用。
 */
export async function cancelSubscription({
  subscriptionId,
  userId,
}: {
  subscriptionId: string;
  userId: string;
}): Promise<void> {
  try {
    // 校验：用户必须是该订阅所属企业的团队成员且为管理员
    const [sub] = await db
      .select({
        enterpriseId: opcSubscription.enterpriseId,
        status: opcSubscription.status,
        clonedAgentId: opcSubscription.clonedAgentId,
      })
      .from(opcSubscription)
      .where(eq(opcSubscription.id, subscriptionId))
      .limit(1);

    if (!sub) {
      throw new ChatbotError("not_found:database", "订阅记录不存在");
    }
    if (sub.status !== "active") {
      throw new ChatbotError("bad_request:database", "订阅已非生效状态");
    }

    // 校验用户是该企业管理员
    const [userRow] = await db
      .select({ enterpriseId: user.enterpriseId })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!userRow?.enterpriseId || userRow.enterpriseId !== sub.enterpriseId) {
      throw new ChatbotError("forbidden:database", "无权限：非该企业成员");
    }

    // 校验团队角色
    const [memberRow] = await db
      .select({ role: teamMember.role })
      .from(teamMember)
      .where(eq(teamMember.userId, userId))
      .limit(1);

    if (memberRow?.role !== "owner" && memberRow?.role !== "admin") {
      throw new ChatbotError("forbidden:database", "无权限：仅企业管理员可取消订阅");
    }

    await db
      .update(opcSubscription)
      .set({ status: "canceled", updatedAt: new Date() })
      .where(eq(opcSubscription.id, subscriptionId));

    // 停用副本 OPC（如果有）
    if (sub.clonedAgentId) {
      await db
        .update(agent)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(agent.id, sub.clonedAgentId));
    }
  } catch (_error) {
    if (_error instanceof ChatbotError) throw _error;
    throw new ChatbotError(
      "bad_request:database",
      "Failed to cancel subscription"
    );
  }
}

/**
 * 获取企业名下全部 OPC（含团队创建 + 订阅副本）。
 * 通过 ownerEnterpriseId 或 sourceAgentId 关联。
 */
export async function getAgentsByEnterprise(enterpriseId: string) {
  try {
    return await db
      .select()
      .from(agent)
      .where(
        or(
          // 企业直接拥有的 OPC（ownerEnterpriseId 匹配）
          eq(agent.ownerEnterpriseId, enterpriseId),
          // 订阅副本（sourceAgentId 非空 + ownerEnterpriseId 匹配）
          and(
            eq(agent.ownerEnterpriseId, enterpriseId),
            eq(agent.ownershipType, "enterprise_private")
          )
        )
      )
      .orderBy(desc(agent.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get agents by enterprise"
    );
  }
}

export async function getVisibleAgents({
  userId,
  teamId,
  accountType = "personal",
  enterpriseId,
  teamRole,
}: {
  userId: string;
  teamId?: string | null;
  accountType?: "personal" | "enterprise";
  enterpriseId?: string | null;
  teamRole?: "owner" | "admin" | "member" | null;
}) {
  try {
    // 全部已上架公共 OPC（管理员可浏览，普通成员不可）
    const publicListed = eq(agent.listingStatus, "listed");

    if (accountType === "enterprise" && enterpriseId) {
      // 企业账号可见的 OPC：
      // ① 团队成员创建的 OPC（teamId 匹配当前团队）
      // ② 本企业私有 OPC（ownerEnterpriseId 匹配，含订阅副本）
      // ③ 已订阅公共 OPC 的副本（sourceAgentId 非空 + ownerEnterpriseId 匹配）
      // ④ 全部上架公共 OPC（浏览，不可编辑）
      const subscribedAgentIds = db
        .select({ agentId: opcSubscription.agentId })
        .from(opcSubscription)
        .where(
          and(
            eq(opcSubscription.enterpriseId, enterpriseId),
            eq(opcSubscription.status, "active")
          )
        );

      return await db
        .select()
        .from(agent)
        .where(
          or(
            // 团队成员创建的 OPC（按 teamId 过滤）
            teamId ? eq(agent.teamId, teamId) : eq(agent.ownerEnterpriseId, enterpriseId),
            // 本企业私有 OPC（含订阅副本，ownerEnterpriseId 匹配）
            eq(agent.ownerEnterpriseId, enterpriseId),
            // 已订阅的公共 OPC 原始记录（兼容旧数据）
            inArray(agent.id, subscribedAgentIds),
            // 全部上架公共 OPC（浏览，不可编辑）
            publicListed
          )
        )
        .orderBy(asc(agent.sortOrder), desc(agent.createdAt));
    }

    // 个人账号：自己的私有 OPC + 全部上架公共 OPC
    return await db
      .select()
      .from(agent)
      .where(
        or(
          // 自己创建的个人私有 OPC
          and(
            eq(agent.ownershipType, "personal_private"),
            eq(agent.userId, userId)
          ),
          // 全部上架公共 OPC（浏览）
          publicListed
        )
      )
      .orderBy(asc(agent.sortOrder), desc(agent.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get visible agents"
    );
  }
}

export async function getDefaultAgent() {
  try {
    const [result] = await db
      .select()
      .from(agent)
      .where(eq(agent.isDefault, true))
      .limit(1);
    return result ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get default agent"
    );
  }
}

export async function updateAgent({
  id,
  name,
  description,
  avatar,
  systemPrompt,
  phone,
  knowledgeId,
  starterQuestions,
  isActive,
  isDefault,
  sortOrder,
  categoryId,
  visibility,
}: {
  id: string;
  name: string;
  description: string;
  avatar: string;
  systemPrompt: string;
  phone?: string | null;
  knowledgeId?: string | null;
  starterQuestions?: string[];
  isActive: boolean;
  isDefault?: boolean;
  sortOrder: number;
  categoryId?: string | null;
  visibility?: "public" | "private";
}) {
  try {
    // When setting as default, use a transaction to ensure only one default exists
    if (isDefault === true) {
      const [result] = await db.transaction(async (tx) => {
        await tx
          .update(agent)
          .set({ isDefault: false })
          .where(eq(agent.isDefault, true));

        const [updated] = await tx
          .update(agent)
          .set({
            name,
            description,
            avatar,
            systemPrompt,
            phone: phone ?? null,
            knowledgeId: knowledgeId ?? null,
            starterQuestions: starterQuestions ?? [],
            isActive,
            isDefault: true,
            sortOrder,
            categoryId: categoryId ?? null,
            ...(visibility ? { visibility } : {}),
            updatedAt: new Date(),
          })
          .where(eq(agent.id, id))
          .returning();

        return [updated];
      });
      return result;
    }

    const [result] = await db
      .update(agent)
      .set({
        name,
        description,
        avatar,
        systemPrompt,
        phone: phone ?? null,
        knowledgeId: knowledgeId ?? null,
        starterQuestions: starterQuestions ?? [],
        isActive,
        ...(isDefault !== undefined ? { isDefault } : {}),
        sortOrder,
        categoryId: categoryId ?? null,
        ...(visibility ? { visibility } : {}),
        updatedAt: new Date(),
      })
      .where(eq(agent.id, id))
      .returning();
    return result;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to update agent");
  }
}

export async function deleteAgent({ id }: { id: string }) {
  try {
    const [result] = await db.delete(agent).where(eq(agent.id, id)).returning();
    return result;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to delete agent");
  }
}

// ============================================================
// Category CRUD
// ============================================================

export async function getCategories() {
  try {
    return await db
      .select()
      .from(category)
      .orderBy(asc(category.sortOrder), asc(category.createdAt));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get categories");
  }
}

export async function getCategoryById({ id }: { id: string }) {
  try {
    const [result] = await db
      .select()
      .from(category)
      .where(eq(category.id, id));
    return result ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get category by id"
    );
  }
}

export async function createCategory({
  name,
  color,
  sortOrder,
  colorKey,
  userId,
}: {
  name: string;
  color: string;
  sortOrder?: number;
  colorKey?: string;
  userId: string;
}) {
  try {
    const [result] = await db
      .insert(category)
      .values({
        name,
        color,
        sortOrder: sortOrder ?? 0,
        colorKey: colorKey ?? "indigo",
        userId,
      })
      .returning();
    return result;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to create category");
  }
}

export async function updateCategory({
  id,
  name,
  color,
  sortOrder,
  colorKey,
}: {
  id: string;
  name: string;
  color: string;
  sortOrder?: number;
  colorKey?: string;
}) {
  try {
    const updates: Record<string, unknown> = { name, color };
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    if (colorKey !== undefined) updates.colorKey = colorKey;
    const [result] = await db
      .update(category)
      .set(updates)
      .where(eq(category.id, id))
      .returning();
    return result;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to update category");
  }
}

export async function deleteCategory({ id }: { id: string }) {
  try {
    const [result] = await db
      .delete(category)
      .where(eq(category.id, id))
      .returning();
    return result;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to delete category");
  }
}

// ============================================================
// SiteConfig CRUD
// ============================================================

export async function getSiteConfig() {
  try {
    const [result] = await db.select().from(siteConfig).limit(1);
    return result ?? null;
  } catch (_error) {
    console.error("getSiteConfig error:", _error);
    throw new ChatbotError("bad_request:database", "Failed to get site config");
  }
}

export async function upsertSiteConfig({
  defaultSystemPrompt,
  defaultStarterQuestions,
  siteName,
  siteDescription,
}: {
  defaultSystemPrompt?: string | null;
  defaultStarterQuestions?: string[] | null;
  siteName?: string | null;
  siteDescription?: string | null;
}) {
  try {
    const existing = await db
      .select({ id: siteConfig.id })
      .from(siteConfig)
      .limit(1);

    if (existing.length > 0) {
      const [result] = await db
        .update(siteConfig)
        .set({
          ...(defaultSystemPrompt !== undefined
            ? { defaultSystemPrompt: defaultSystemPrompt || null }
            : {}),
          ...(defaultStarterQuestions !== undefined
            ? { defaultStarterQuestions: defaultStarterQuestions || null }
            : {}),
          ...(siteName !== undefined ? { siteName: siteName || null } : {}),
          ...(siteDescription !== undefined
            ? { siteDescription: siteDescription || null }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(siteConfig.id, existing[0].id))
        .returning();
      return result;
    }

    const [result] = await db
      .insert(siteConfig)
      .values({
        defaultSystemPrompt: defaultSystemPrompt ?? null,
        defaultStarterQuestions: defaultStarterQuestions ?? null,
        siteName: siteName ?? null,
        siteDescription: siteDescription ?? null,
      })
      .returning();
    return result;
  } catch (_error) {
    console.error("upsertSiteConfig error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to upsert site config"
    );
  }
}

// ============================================================
// Password Reset
// ============================================================

export async function createPasswordResetToken({
  email,
  token,
  expiresAt,
}: {
  email: string;
  token: string;
  expiresAt: Date;
}) {
  try {
    const [result] = await db
      .insert(passwordResetToken)
      .values({ email, token, expiresAt })
      .returning();
    return result;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create password reset token"
    );
  }
}

export async function getPasswordResetToken({ token }: { token: string }) {
  try {
    const [result] = await db
      .select()
      .from(passwordResetToken)
      .where(
        and(
          eq(passwordResetToken.token, token),
          isNull(passwordResetToken.usedAt),
          gt(passwordResetToken.expiresAt, new Date())
        )
      );
    return result ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get password reset token"
    );
  }
}

export async function markResetTokenAsUsed({ id }: { id: string }) {
  try {
    await db
      .update(passwordResetToken)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetToken.id, id));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to mark reset token as used"
    );
  }
}

export async function updateUserPassword({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  try {
    const hashedPassword = generateHashedPassword(password);
    await db
      .update(user)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(user.email, email));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update user password"
    );
  }
}

// ============================================================
// Dashboard Stats (admin only)
// ============================================================

// ============================================================
// User Management (admin only)
// ============================================================

export async function getUserManagementStats() {
  try {
    // User list with activity stats
    const userList = await db.execute(sql`
      SELECT
        u.id,
        u.email,
        u.name,
        u."isAnonymous",
        u.role,
        u."createdAt",
        u."updatedAt",
        COUNT(DISTINCT c.id) AS "chatCount",
        COUNT(DISTINCT m.id) AS "messageCount",
        MAX(c."createdAt") AS "lastActivityAt",
        COUNT(DISTINCT CASE WHEN v."isUpvoted" = true THEN v."messageId" END) AS "upvotes",
        COUNT(DISTINCT CASE WHEN v."isUpvoted" = false THEN v."messageId" END) AS "downvotes"
      FROM "User" u
      LEFT JOIN "Chat" c ON c."userId" = u.id
      LEFT JOIN "Message_v2" m ON m."chatId" = c.id AND m.role = 'user'
      LEFT JOIN "Vote_v2" v ON v."chatId" = c.id
      GROUP BY u.id, u.email, u.name, u."isAnonymous", u.role, u."createdAt", u."updatedAt"
      ORDER BY MAX(c."createdAt") DESC NULLS LAST, u."createdAt" DESC
    `);

    // Conversion funnel: guest vs registered
    const conversion = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE u."isAnonymous" = true) AS "guestUsers",
        COUNT(*) FILTER (WHERE u."isAnonymous" = false) AS "registeredUsers",
        COUNT(*) AS "totalUsers"
      FROM "User" u
    `);

    // Feedback summary: all votes aggregated
    const feedback = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE v."isUpvoted" = true) AS "totalUpvotes",
        COUNT(*) FILTER (WHERE v."isUpvoted" = false) AS "totalDownvotes",
        COUNT(DISTINCT v."chatId") AS "votedChats",
        COUNT(DISTINCT v."messageId") AS "votedMessages"
      FROM "Vote_v2" v
    `);

    const conversionRow = (conversion as unknown as Record<string, string>[])[0] ?? {};
    const feedbackRow = (feedback as unknown as Record<string, string>[])[0] ?? {};

    return {
      users: (userList as unknown as Record<string, string>[]).map((row) => ({
        id: row.id,
        email: row.email,
        name: row.name,
        isAnonymous: row.isAnonymous === 'true' || row.isAnonymous === 't',
        role: row.role || 'user',
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        chatCount: Number(row.chatCount ?? 0),
        messageCount: Number(row.messageCount ?? 0),
        lastActivityAt: row.lastActivityAt,
        upvotes: Number(row.upvotes ?? 0),
        downvotes: Number(row.downvotes ?? 0),
      })),
      conversion: {
        guestUsers: Number(conversionRow.guestUsers ?? 0),
        registeredUsers: Number(conversionRow.registeredUsers ?? 0),
        totalUsers: Number(conversionRow.totalUsers ?? 0),
      },
      feedback: {
        totalUpvotes: Number(feedbackRow.totalUpvotes ?? 0),
        totalDownvotes: Number(feedbackRow.totalDownvotes ?? 0),
        votedChats: Number(feedbackRow.votedChats ?? 0),
        votedMessages: Number(feedbackRow.votedMessages ?? 0),
      },
    };
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get user management stats"
    );
  }
}

export async function deleteAllGuestUsers() {
  try {
    return await db.transaction(async (tx) => {
      // Get all guest user IDs
      const guestUsers = await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.isAnonymous, true));

      if (guestUsers.length === 0) {
        return { deletedCount: 0 };
      }

      const guestUserIds = guestUsers.map((u) => u.id);

      // Delete all related data (cascading will handle votes, messages, chats, documents, etc.)
      const deletedUsers = await tx
        .delete(user)
        .where(inArray(user.id, guestUserIds))
        .returning();

      return { deletedCount: deletedUsers.length };
    });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete guest users"
    );
  }
}

export async function getDashboardStats() {
  try {
    // Overview counts
    const [chatCount] = await db.select({ value: count() }).from(chat);
    const [userCount] = await db.select({ value: count() }).from(user);
    const [agentCount] = await db.select({ value: count() }).from(agent);
    const [activeAgentCount] = await db
      .select({ value: count() })
      .from(agent)
      .where(eq(agent.isActive, true));
    const [messageCount] = await db.select({ value: count() }).from(message);

    // Vote totals
    const [upvotes] = await db
      .select({ value: count() })
      .from(vote)
      .where(eq(vote.isUpvoted, true));
    const [downvotes] = await db
      .select({ value: count() })
      .from(vote)
      .where(eq(vote.isUpvoted, false));

    // Period stats
    const periods = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE c."createdAt" > NOW() - INTERVAL '1 day') AS "todayChats",
        COUNT(*) FILTER (WHERE c."createdAt" > NOW() - INTERVAL '7 days') AS "weekChats",
        COUNT(*) FILTER (WHERE c."createdAt" > NOW() - INTERVAL '30 days') AS "monthChats",
        COUNT(DISTINCT CASE WHEN c."createdAt" > NOW() - INTERVAL '1 day' THEN c."userId" END) AS "todayUsers",
        COUNT(DISTINCT CASE WHEN c."createdAt" > NOW() - INTERVAL '7 days' THEN c."userId" END) AS "weekUsers",
        COUNT(DISTINCT CASE WHEN c."createdAt" > NOW() - INTERVAL '30 days' THEN c."userId" END) AS "monthUsers"
      FROM "Chat" c
    `);

    // Per-agent stats
    const agentStats = await db.execute(sql`
      SELECT
        a.name AS "agentName",
        COUNT(DISTINCT c.id) AS "chatCount",
        COUNT(DISTINCT m.id) AS "messageCount",
        COUNT(DISTINCT CASE WHEN v."isUpvoted" = true THEN v."messageId" END) AS "upvotes",
        COUNT(DISTINCT CASE WHEN v."isUpvoted" = false THEN v."messageId" END) AS "downvotes"
      FROM "Agent" a
      LEFT JOIN "Chat" c ON c."agentId" = a.id
      LEFT JOIN "Message_v2" m ON m."chatId" = c.id AND m.role = 'assistant'
      LEFT JOIN "Vote_v2" v ON v."chatId" = c.id AND v."messageId" = m.id
      GROUP BY a.id, a.name
      ORDER BY COUNT(DISTINCT c.id) DESC
    `);

    const periodRow = (periods as unknown as Record<string, string>[])[0] ?? {};

    return {
      overview: {
        totalChats: chatCount.value,
        totalUsers: userCount.value,
        totalAgents: agentCount.value,
        activeAgents: activeAgentCount.value,
        totalMessages: messageCount.value,
        totalUpvotes: upvotes.value,
        totalDownvotes: downvotes.value,
      },
      periods: {
        todayChats: Number(periodRow.todayChats ?? 0),
        weekChats: Number(periodRow.weekChats ?? 0),
        monthChats: Number(periodRow.monthChats ?? 0),
        todayUsers: Number(periodRow.todayUsers ?? 0),
        weekUsers: Number(periodRow.weekUsers ?? 0),
        monthUsers: Number(periodRow.monthUsers ?? 0),
      },
      agentStats: (agentStats as unknown as Record<string, string>[]).map(
        (row) => ({
          agentName: row.agentName,
          chatCount: Number(row.chatCount ?? 0),
          messageCount: Number(row.messageCount ?? 0),
          upvotes: Number(row.upvotes ?? 0),
          downvotes: Number(row.downvotes ?? 0),
        })
      ),
    };
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get dashboard stats"
    );
  }
}

// ===== 用户知识库关联查询 =====

/** 获取用户创建的所有知识库 */
export async function getUserKnowledgeBases({ userId }: { userId: string }) {
  try {
    return await db
      .select()
      .from(userKnowledge)
      .where(eq(userKnowledge.userId, userId))
      .orderBy(desc(userKnowledge.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get user knowledge bases"
    );
  }
}

/** 记录用户创建的知识库 */
export async function createUserKnowledgeRecord({
  userId,
  knowledgeId,
  name,
  description,
}: {
  userId: string;
  knowledgeId: string;
  name: string;
  description?: string;
}) {
  try {
    return await db
      .insert(userKnowledge)
      .values({
        userId,
        knowledgeId,
        name,
        description: description ?? null,
      })
      .returning();
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create user knowledge record"
    );
  }
}

/** 删除用户知识库记录 */
export async function deleteUserKnowledgeRecord({
  userId,
  knowledgeId,
}: {
  userId: string;
  knowledgeId: string;
}) {
  try {
    return await db
      .delete(userKnowledge)
      .where(
        and(
          eq(userKnowledge.userId, userId),
          eq(userKnowledge.knowledgeId, knowledgeId)
        )
      )
      .returning();
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete user knowledge record"
    );
  }
}

/** 检查用户是否拥有指定知识库 */
export async function checkUserKnowledgeOwnership(
  userId: string,
  knowledgeId: string
): Promise<boolean> {
  try {
    const records = await db
      .select({ id: userKnowledge.id })
      .from(userKnowledge)
      .where(
        and(
          eq(userKnowledge.userId, userId),
          eq(userKnowledge.knowledgeId, knowledgeId)
        )
      )
      .limit(1);
    return records.length > 0;
  } catch (_error) {
    return false;
  }
}

// ============================================================
// TicketCategory CRUD —— 工单分类（任务类型）
// ============================================================

export async function getTicketCategories(): Promise<TicketCategory[]> {
  try {
    return await db
      .select()
      .from(ticketCategory)
      .orderBy(asc(ticketCategory.sortOrder), asc(ticketCategory.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get ticket categories"
    );
  }
}

export async function getTicketCategoryById({
  id,
}: {
  id: string;
}): Promise<TicketCategory | null> {
  try {
    const [result] = await db
      .select()
      .from(ticketCategory)
      .where(eq(ticketCategory.id, id));
    return result ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get ticket category by id"
    );
  }
}

export async function createTicketCategory({
  name,
  color,
  sortOrder,
  colorKey,
  userId,
}: {
  name: string;
  color: string;
  sortOrder?: number;
  colorKey?: string;
  userId: string;
}) {
  try {
    const [result] = await db
      .insert(ticketCategory)
      .values({
        name,
        color,
        sortOrder: sortOrder ?? 0,
        colorKey: colorKey ?? "indigo",
        userId,
      })
      .returning();
    return result;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create ticket category"
    );
  }
}

export async function updateTicketCategory({
  id,
  name,
  color,
  sortOrder,
  colorKey,
}: {
  id: string;
  name: string;
  color: string;
  sortOrder?: number;
  colorKey?: string;
}) {
  try {
    const updates: Record<string, unknown> = { name, color };
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    if (colorKey !== undefined) updates.colorKey = colorKey;
    const [result] = await db
      .update(ticketCategory)
      .set(updates)
      .where(eq(ticketCategory.id, id))
      .returning();
    return result;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update ticket category"
    );
  }
}

export async function deleteTicketCategory({ id }: { id: string }) {
  try {
    const [result] = await db
      .delete(ticketCategory)
      .where(eq(ticketCategory.id, id))
      .returning();
    return result;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete ticket category"
    );
  }
}

// ============================================================
// Ticket CRUD —— 工单
// ============================================================

export async function getTickets(): Promise<Ticket[]> {
  try {
    return await db
      .select()
      .from(ticket)
      .where(eq(ticket.isDeleted, false))
      .orderBy(asc(ticket.sortOrder), desc(ticket.createdAt));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get tickets");
  }
}

// ── Ticket cache (5-min TTL, invalidated on CRUD mutations) ──
const ticketCache = new Map<string, { data: unknown; ts: number }>();
const TICKET_CACHE_TTL = 5 * 60 * 1000;

export function invalidateTicketCache(id: string): void {
  ticketCache.delete(id);
}

export async function getTicketById({
  id,
}: {
  id: string;
}): Promise<Ticket | null> {
  const cached = ticketCache.get(id);
  if (cached && Date.now() - cached.ts < TICKET_CACHE_TTL) {
    return cached.data as Ticket;
  }
  try {
    const [result] = await db
      .select()
      .from(ticket)
      .where(and(eq(ticket.id, id), eq(ticket.isDeleted, false)));
    if (result) {
      ticketCache.set(id, { data: result, ts: Date.now() });
    }
    return result ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get ticket by id"
    );
  }
}

export async function getTicketsByUserId({
  userId,
}: {
  userId: string;
}): Promise<Ticket[]> {
  try {
    return await db
      .select()
      .from(ticket)
      .where(and(eq(ticket.userId, userId), eq(ticket.isDeleted, false)))
      .orderBy(asc(ticket.sortOrder), desc(ticket.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get tickets by user id"
    );
  }
}

/**
 * 获取对用户可见的工单：
 * - 管理员：所有 public 工单
 * - 普通用户：所有 public 工单 + 自己创建的 private 工单
 * 仅返回未软删除且审核通过的工单（普通用户视角）
 */
export async function getVisibleTickets({
  userId,
  userIsAdmin,
}: {
  userId: string;
  userIsAdmin: boolean;
}): Promise<Ticket[]> {
  try {
    const visibilityCondition = userIsAdmin
      ? eq(ticket.visibility, "public")
      : or(
          eq(ticket.visibility, "public"),
          and(eq(ticket.visibility, "private"), eq(ticket.userId, userId))
        );
    // 普通用户只能看到审核通过的；管理员可见全部审核状态
    const reviewCondition = userIsAdmin
      ? undefined
      : eq(ticket.reviewStatus, "approved");
    const condition = reviewCondition
      ? and(visibilityCondition, reviewCondition, eq(ticket.isDeleted, false))
      : and(visibilityCondition, eq(ticket.isDeleted, false));
    return await db
      .select()
      .from(ticket)
      .where(condition)
      .orderBy(asc(ticket.sortOrder), desc(ticket.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get visible tickets"
    );
  }
}

export async function createTicket({
  title,
  description,
  content,
  priority,
  status,
  progress,
  assignee,
  phone,
  dueDate,
  categoryId,
  userId,
  visibility = "public",
  isActive,
  sortOrder,
  publishSource = "manual",
  reviewStatus = "approved",
  reviewedById,
  reviewedAt,
  reviewNote,
  expiryDate,
  contactName,
  province,
  city,
  formData,
  aiRawText,
}: {
  title: string;
  description: string;
  content?: string | null;
  priority?: "low" | "medium" | "high" | "urgent";
  status?: "pending" | "in_progress" | "completed" | "closed";
  progress?: number;
  assignee?: string | null;
  phone?: string | null;
  dueDate?: Date | null;
  categoryId?: string | null;
  userId: string;
  visibility?: "public" | "private";
  isActive: boolean;
  sortOrder: number;
  publishSource?: "ai" | "manual";
  reviewStatus?: "pending" | "approved" | "rejected";
  reviewedById?: string | null;
  reviewedAt?: Date | null;
  reviewNote?: string | null;
  expiryDate?: Date | null;
  contactName?: string | null;
  province?: string | null;
  city?: string | null;
  formData?: Record<string, unknown> | null;
  aiRawText?: string | null;
}) {
  try {
    const [result] = await db
      .insert(ticket)
      .values({
        title,
        description,
        content: content ?? null,
        priority: priority ?? "medium",
        status: status ?? "pending",
        progress: progress ?? 0,
        assignee: assignee ?? null,
        phone: phone ?? null,
        dueDate: dueDate ?? null,
        categoryId: categoryId ?? null,
        userId,
        visibility,
        isActive,
        sortOrder,
        publishSource,
        reviewStatus,
        reviewedById: reviewedById ?? null,
        reviewedAt: reviewedAt ?? null,
        reviewNote: reviewNote ?? null,
        expiryDate: expiryDate ?? null,
        contactName: contactName ?? null,
        province: province ?? null,
        city: city ?? null,
        formData: formData ?? null,
        aiRawText: aiRawText ?? null,
      })
      .returning();
    return result;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to create ticket");
  }
}

export async function updateTicket({
  id,
  title,
  description,
  content,
  priority,
  status,
  progress,
  assignee,
  phone,
  dueDate,
  categoryId,
  visibility,
  isActive,
  sortOrder,
  expiryDate,
  contactName,
  province,
  city,
  formData,
  reviewStatus,
  reviewedById,
  reviewedAt,
  reviewNote,
}: {
  id: string;
  title: string;
  description: string;
  content?: string | null;
  priority?: "low" | "medium" | "high" | "urgent";
  status?: "pending" | "in_progress" | "completed" | "closed";
  progress?: number;
  assignee?: string | null;
  phone?: string | null;
  dueDate?: Date | null;
  categoryId?: string | null;
  visibility?: "public" | "private";
  isActive: boolean;
  sortOrder: number;
  expiryDate?: Date | null;
  contactName?: string | null;
  province?: string | null;
  city?: string | null;
  formData?: Record<string, unknown> | null;
  // 🆕 审核字段：支持编辑后重置审核状态
  reviewStatus?: "pending" | "approved" | "rejected";
  reviewedById?: string | null;
  reviewedAt?: Date | null;
  reviewNote?: string | null;
}) {
  try {
    const updates: Record<string, unknown> = {
      title,
      description,
      content: content ?? null,
      priority: priority ?? "medium",
      status: status ?? "pending",
      progress: progress ?? 0,
      assignee: assignee ?? null,
      phone: phone ?? null,
      dueDate: dueDate ?? null,
      categoryId: categoryId ?? null,
      isActive,
      sortOrder,
      expiryDate: expiryDate ?? null,
      contactName: contactName ?? null,
      province: province ?? null,
      city: city ?? null,
      formData: formData ?? null,
      updatedAt: new Date(),
    };
    if (visibility) updates.visibility = visibility;
    // 🆕 仅当显式传入审核字段时才更新，避免覆盖现有审核状态
    if (reviewStatus !== undefined) updates.reviewStatus = reviewStatus;
    if (reviewedById !== undefined) updates.reviewedById = reviewedById;
    if (reviewedAt !== undefined) updates.reviewedAt = reviewedAt;
    if (reviewNote !== undefined) updates.reviewNote = reviewNote;

    const [result] = await db
      .update(ticket)
      .set(updates)
      .where(eq(ticket.id, id))
      .returning();
    return result;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to update ticket");
  }
}

export async function deleteTicket({ id }: { id: string }) {
  try {
    // 软删除：保留数据可恢复，避免硬删除丢失
    const [result] = await db
      .update(ticket)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(ticket.id, id))
      .returning();
    return result;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to delete ticket");
  }
}

// 恢复软删除的工单
export async function restoreTicket({ id }: { id: string }) {
  try {
    const [result] = await db
      .update(ticket)
      .set({ isDeleted: false, deletedAt: null, updatedAt: new Date() })
      .where(eq(ticket.id, id))
      .returning();
    return result;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to restore ticket",
    );
  }
}

// ============================================================
// 工单审核工作流 —— 管理员审核 AI/用户发布内容
// ============================================================

export async function reviewTicket({
  id,
  reviewStatus,
  reviewedById,
  reviewNote,
}: {
  id: string;
  reviewStatus: "approved" | "rejected";
  reviewedById: string;
  reviewNote?: string | null;
}) {
  try {
    const now = new Date();
    const updates: Record<string, unknown> = {
      reviewStatus,
      reviewedById,
      reviewedAt: now,
      reviewNote: reviewNote ?? null,
      updatedAt: now,
    };
    // 审核通过后，工单进入进行中状态并发布到市场（visibility=public），
    // 这样其他用户才能在「发现市场」看到该工单；
    // 驳回则保持待处理并停用。
    if (reviewStatus === "approved") {
      updates.status = "in_progress";
      updates.isActive = true;
      updates.visibility = "public";
    } else {
      updates.isActive = false;
    }
    const [result] = await db
      .update(ticket)
      .set(updates)
      .where(eq(ticket.id, id))
      .returning();
    return result;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to review ticket",
    );
  }
}

// 批量审核
export async function batchReviewTickets({
  ids,
  reviewStatus,
  reviewedById,
  reviewNote,
}: {
  ids: string[];
  reviewStatus: "approved" | "rejected";
  reviewedById: string;
  reviewNote?: string | null;
}) {
  try {
    const now = new Date();
    const updates: Record<string, unknown> = {
      reviewStatus,
      reviewedById,
      reviewedAt: now,
      reviewNote: reviewNote ?? null,
      updatedAt: now,
    };
    if (reviewStatus === "approved") {
      updates.status = "in_progress";
      updates.isActive = true;
      updates.visibility = "public";
    } else {
      updates.isActive = false;
    }
    const results = await db
      .update(ticket)
      .set(updates)
      .where(inArray(ticket.id, ids))
      .returning();
    return results;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to batch review tickets",
    );
  }
}

// 浏览量自增（供需信息热度指标）
export async function incrementTicketViewCount({ id }: { id: string }) {
  try {
    const [result] = await db
      .update(ticket)
      .set({
        viewCount: sql`${ticket.viewCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(ticket.id, id))
      .returning();
    return result;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to increment view count",
    );
  }
}

/**
 * 发布工单到市场 —— 管理员一键发布
 *
 * 与 reviewTicket(approved) 等价，但语义更清晰：
 * 将已启动（isActive）但未发布（visibility=private 或 reviewStatus=pending）
 * 的工单发布到「发现市场」，使其对所有用户可见。
 *
 * 适用场景：普通用户/AI 创建工单后处于「启动状态但未发布」，
 * 管理员审核后点击「发布到市场」按钮调用此函数。
 */
export async function publishTicket({
  id,
  reviewedById,
  reviewNote,
}: {
  id: string;
  reviewedById: string;
  reviewNote?: string | null;
}) {
  try {
    const now = new Date();
    const [result] = await db
      .update(ticket)
      .set({
        visibility: "public",
        reviewStatus: "approved",
        reviewedById,
        reviewedAt: now,
        reviewNote: reviewNote ?? null,
        status: "in_progress",
        isActive: true,
        updatedAt: now,
      })
      .where(eq(ticket.id, id))
      .returning();
    return result;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to publish ticket",
    );
  }
}

/**
 * 获取「已启动但未发布到市场」的工单列表
 *
 * 判定条件：isActive=true 且 (visibility=private 或 reviewStatus=pending)
 * 用于管理员通知横幅，提醒审核发布。
 */
export async function getUnpublishedActiveTickets({
  limit = 50,
}: { limit?: number } = {}) {
  try {
    return await db
      .select()
      .from(ticket)
      .where(
        and(
          eq(ticket.isActive, true),
          eq(ticket.isDeleted, false),
          or(
            eq(ticket.visibility, "private"),
            eq(ticket.reviewStatus, "pending"),
          ),
        ),
      )
      .orderBy(desc(ticket.createdAt))
      .limit(limit);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get unpublished active tickets",
    );
  }
}

// 获取待审核工单（管理员审核队列）
export async function getPendingReviewTickets({
  limit = 50,
}: { limit?: number } = {}) {
  try {
    return await db
      .select()
      .from(ticket)
      .where(
        and(eq(ticket.reviewStatus, "pending"), eq(ticket.isDeleted, false)),
      )
      .orderBy(desc(ticket.createdAt))
      .limit(limit);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get pending review tickets",
    );
  }
}

// 工单发布统计概览（管理员仪表盘 —— 发布来源 / 审核状态维度）
export async function getTicketPublishStats() {
  try {
    const [totalRow] = await db
      .select({ count: count() })
      .from(ticket)
      .where(eq(ticket.isDeleted, false));
    const [pendingRow] = await db
      .select({ count: count() })
      .from(ticket)
      .where(
        and(
          eq(ticket.reviewStatus, "pending"),
          eq(ticket.isDeleted, false),
        ),
      );
    const [aiRow] = await db
      .select({ count: count() })
      .from(ticket)
      .where(
        and(
          eq(ticket.publishSource, "ai"),
          eq(ticket.isDeleted, false),
        ),
      );
    const [manualRow] = await db
      .select({ count: count() })
      .from(ticket)
      .where(
        and(
          eq(ticket.publishSource, "manual"),
          eq(ticket.isDeleted, false),
        ),
      );
    return {
      total: totalRow?.count ?? 0,
      pendingReview: pendingRow?.count ?? 0,
      aiPublished: aiRow?.count ?? 0,
      manualPublished: manualRow?.count ?? 0,
    };
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get ticket stats",
    );
  }
}

// ============================================================
// 工单批量操作 —— 产品优化项
// ============================================================

export async function batchUpdateTicketStatus({
  ids,
  status,
}: {
  ids: string[];
  status: "pending" | "in_progress" | "completed" | "closed";
}) {
  try {
    const results = await db
      .update(ticket)
      .set({ status, updatedAt: new Date() })
      .where(inArray(ticket.id, ids))
      .returning();
    return results;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to batch update ticket status"
    );
  }
}

export async function batchUpdateTicketPriority({
  ids,
  priority,
}: {
  ids: string[];
  priority: "low" | "medium" | "high" | "urgent";
}) {
  try {
    const results = await db
      .update(ticket)
      .set({ priority, updatedAt: new Date() })
      .where(inArray(ticket.id, ids))
      .returning();
    return results;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to batch update ticket priority"
    );
  }
}

export async function batchDeleteTickets({ ids }: { ids: string[] }) {
  try {
    const results = await db
      .delete(ticket)
      .where(inArray(ticket.id, ids))
      .returning();
    return results;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to batch delete tickets"
    );
  }
}

// ============================================================
// 工单评论 CRUD —— 协作讨论
// ============================================================

export async function getTicketComments({
  ticketId,
}: {
  ticketId: string;
}): Promise<TicketComment[]> {
  try {
    return await db
      .select()
      .from(ticketComment)
      .where(eq(ticketComment.ticketId, ticketId))
      .orderBy(asc(ticketComment.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get ticket comments"
    );
  }
}

export async function createTicketComment({
  ticketId,
  userId,
  content,
}: {
  ticketId: string;
  userId: string;
  content: string;
}) {
  try {
    const [result] = await db
      .insert(ticketComment)
      .values({ ticketId, userId, content })
      .returning();

    // 同步记录活动日志
    await db.insert(ticketActivity).values({
      ticketId,
      userId,
      type: "commented",
      summary: "添加了评论",
      newValue: content.slice(0, 200),
    });

    return result;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create ticket comment"
    );
  }
}

export async function deleteTicketComment({ id }: { id: string }) {
  try {
    const [result] = await db
      .delete(ticketComment)
      .where(eq(ticketComment.id, id))
      .returning();
    return result;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete ticket comment"
    );
  }
}

// ============================================================
// 工单活动日志 —— 操作追溯
// ============================================================

export async function getTicketActivities({
  ticketId,
}: {
  ticketId: string;
}): Promise<TicketActivity[]> {
  try {
    return await db
      .select()
      .from(ticketActivity)
      .where(eq(ticketActivity.ticketId, ticketId))
      .orderBy(desc(ticketActivity.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get ticket activities"
    );
  }
}

/**
 * 记录工单字段变更活动日志（供 updateTicket 调用）
 */
export async function logTicketActivity({
  ticketId,
  userId,
  type,
  summary,
  oldValue,
  newValue,
}: {
  ticketId: string;
  userId: string;
  type:
    | "created"
    | "updated"
    | "status_changed"
    | "priority_changed"
    | "assignee_changed"
    | "commented"
    | "deleted"
    | "reviewed";
  summary: string;
  oldValue?: string | null;
  newValue?: string | null;
}) {
  try {
    await db.insert(ticketActivity).values({
      ticketId,
      userId,
      type,
      summary,
      oldValue: oldValue ?? null,
      newValue: newValue ?? null,
    });
  } catch (_error) {
    // 活动日志记录失败不应阻断主流程
    console.error("Failed to log ticket activity:", _error);
  }
}

// ============================================================
// 工单标签 CRUD —— 多维度标记
// ============================================================

export async function getTicketTags(): Promise<TicketTag[]> {
  try {
    return await db.select().from(ticketTag).orderBy(asc(ticketTag.name));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get ticket tags");
  }
}

export async function createTicketTag({
  name,
  color,
  userId,
}: {
  name: string;
  color: string;
  userId: string;
}) {
  try {
    const [result] = await db
      .insert(ticketTag)
      .values({ name, color, userId })
      .returning();
    return result;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to create ticket tag");
  }
}

export async function deleteTicketTag({ id }: { id: string }) {
  try {
    const [result] = await db
      .delete(ticketTag)
      .where(eq(ticketTag.id, id))
      .returning();
    return result;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to delete ticket tag");
  }
}

/** 获取工单关联的所有标签 ID */
export async function getTicketTagIds({
  ticketId,
}: {
  ticketId: string;
}): Promise<string[]> {
  try {
    const results = await db
      .select({ tagId: ticketTagRelation.tagId })
      .from(ticketTagRelation)
      .where(eq(ticketTagRelation.ticketId, ticketId));
    return results.map((r) => r.tagId);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get ticket tag ids"
    );
  }
}

/** 设置工单的标签（全量覆盖） */
export async function setTicketTags({
  ticketId,
  tagIds,
}: {
  ticketId: string;
  tagIds: string[];
}) {
  try {
    // 先删除旧关联
    await db
      .delete(ticketTagRelation)
      .where(eq(ticketTagRelation.ticketId, ticketId));

    // 再批量插入新关联
    if (tagIds.length > 0) {
      await db.insert(ticketTagRelation).values(
        tagIds.map((tagId) => ({ ticketId, tagId }))
      );
    }
    return tagIds;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to set ticket tags"
    );
  }
}

// ============================================================
// 工单统计 —— 扩展统计看板
// ============================================================

export async function getTicketStats() {
  try {
    const allTickets = await db.select().from(ticket);
    const now = new Date();

    const byStatus = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      closed: 0,
    };
    const byPriority = { low: 0, medium: 0, high: 0, urgent: 0 };
    const byCategory: Record<string, number> = {};
    const byAssignee: Record<string, number> = {};

    let overdue = 0;
    let urgentOpen = 0;

    for (const t of allTickets) {
      byStatus[t.status]++;
      byPriority[t.priority]++;
      if (t.categoryId) {
        byCategory[t.categoryId] = (byCategory[t.categoryId] ?? 0) + 1;
      }
      if (t.assignee) {
        byAssignee[t.assignee] = (byAssignee[t.assignee] ?? 0) + 1;
      }
      // 逾期：截止日期已过且未完成/未关闭
      if (
        t.dueDate &&
        t.dueDate < now &&
        t.status !== "completed" &&
        t.status !== "closed"
      ) {
        overdue++;
      }
      // 紧急且未关闭
      if (t.priority === "urgent" && t.status !== "closed") {
        urgentOpen++;
      }
    }

    return {
      total: allTickets.length,
      byStatus,
      byPriority,
      byCategory,
      byAssignee,
      overdue,
      urgentOpen,
    };
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get ticket stats");
  }
}

// ============================================================
// SaaS 多租户：团队 / 成员 / 邀请 / 活动日志 查询函数
// 从 saas-starter 的 lib/db/queries.ts 移植，适配 opcbot 的
// uuid 主键 + camelCase 列名 + drizzle query builder 风格
// ============================================================

/**
 * 创建团队，并把创建者写入 TeamMember 表（角色 owner）。
 * 用于用户首次注册后的团队初始化，或用户主动创建新团队。
 */
export async function createTeamWithOwner({
  userId,
  name,
}: {
  userId: string;
  name: string;
}): Promise<Team> {
  try {
    return await db.transaction(async (tx) => {
      const [newTeam] = await tx
        .insert(team)
        .values({
          name,
          ownerId: userId,
          planName: "free",
          // free 套餐默认配额：每月 100 条消息，最多 3 名成员
          maxMessages: 100,
          maxMembers: 3,
          usedMessages: 0,
          usageResetAt: new Date(),
        })
        .returning();

      await tx.insert(teamMember).values({
        teamId: newTeam.id,
        userId,
        role: "owner",
      });

      return newTeam;
    });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to create team");
  }
}

/**
 * 获取团队详情（含成员列表，用于团队设置页）。
 * 仅团队成员本人可调用（调用方需先校验权限）。
 *
 * 注：opcbot 的 db 构造为 drizzle(client) 未注入 schema，无法用 db.query 的
 * with 关联，这里用显式 join + 手动分组组装成员列表。
 */
export async function getTeamWithMembers({
  teamId,
}: {
  teamId: string;
}): Promise<TeamDataWithMembers | null> {
  try {
    const rows = await db
      .select({
        team,
        memberId: teamMember.id,
        memberRole: teamMember.role,
        memberCreatedAt: teamMember.createdAt,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userImage: user.image,
      })
      .from(team)
      .innerJoin(teamMember, eq(teamMember.teamId, team.id))
      .innerJoin(user, eq(user.id, teamMember.userId))
      .where(eq(team.id, teamId));

    if (rows.length === 0) {
      return null;
    }

    const teamRow = rows[0].team;
    const teamMembers = rows.map((r) => ({
      id: r.memberId,
      teamId: teamRow.id,
      userId: r.userId,
      role: r.memberRole,
      createdAt: r.memberCreatedAt,
      updatedAt: r.memberCreatedAt,
      user: {
        id: r.userId,
        name: r.userName,
        email: r.userEmail,
        image: r.userImage,
      },
    }));

    return { ...teamRow, teamMembers };
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get team with members"
    );
  }
}

/**
 * 创建团队成员邀请（pending 状态）。
 * 同一团队对同一邮箱只允许有一个 pending 邀请。
 */
export async function createInvitation({
  teamId,
  email,
  role,
  invitedBy,
}: {
  teamId: string;
  email: string;
  role: "owner" | "admin" | "member";
  invitedBy: string;
}): Promise<Invitation> {
  try {
    // 先撤销该邮箱在该团队的既有 pending 邀请
    await db
      .update(invitation)
      .set({ status: "revoked" })
      .where(
        and(
          eq(invitation.teamId, teamId),
          eq(invitation.email, email),
          eq(invitation.status, "pending")
        )
      );

    const [inv] = await db
      .insert(invitation)
      .values({ teamId, email, role, invitedBy })
      .returning();
    return inv;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create invitation"
    );
  }
}

/**
 * 接受邀请：校验邮箱匹配 + 状态为 pending，写入 TeamMember 并标记 accepted。
 */
export async function acceptInvitation({
  invitationId,
  userId,
  email,
}: {
  invitationId: string;
  userId: string;
  email: string;
}): Promise<{ teamId: string; role: "owner" | "admin" | "member" }> {
  try {
    return await db.transaction(async (tx) => {
      const [inv] = await tx
        .select()
        .from(invitation)
        .where(eq(invitation.id, invitationId))
        .limit(1);

      if (!inv || inv.email !== email || inv.status !== "pending") {
        throw new ChatbotError(
          "bad_request:database",
          "Invitation not found or already processed"
        );
      }

      await tx
        .update(invitation)
        .set({ status: "accepted" })
        .where(eq(invitation.id, invitationId));

      await tx.insert(teamMember).values({
        teamId: inv.teamId,
        userId,
        role: inv.role,
      });

      return { teamId: inv.teamId, role: inv.role };
    });
  } catch (_error) {
    if (_error instanceof ChatbotError) throw _error;
    throw new ChatbotError(
      "bad_request:database",
      "Failed to accept invitation"
    );
  }
}

/**
 * 移除团队成员（owner 不能被移除）。
 */
export async function removeTeamMember({
  teamId,
  userId,
}: {
  teamId: string;
  userId: string;
}): Promise<void> {
  try {
    await db
      .delete(teamMember)
      .where(
        and(eq(teamMember.teamId, teamId), eq(teamMember.userId, userId))
      );
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to remove team member"
    );
  }
}

/**
 * 更新团队成员角色。
 */
export async function updateTeamMemberRole({
  teamId,
  userId,
  role,
}: {
  teamId: string;
  userId: string;
  role: "owner" | "admin" | "member";
}): Promise<void> {
  try {
    await db
      .update(teamMember)
      .set({ role })
      .where(
        and(eq(teamMember.teamId, teamId), eq(teamMember.userId, userId))
      );
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update team member role"
    );
  }
}

/**
 * 写入活动日志（登录、创建团队、邀请成员等）。
 */
export async function logActivity({
  teamId,
  userId,
  action,
  ipAddress,
}: {
  teamId?: string | null;
  userId: string;
  action: string;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    await db.insert(activityLog).values({
      teamId: teamId ?? null,
      userId,
      action,
      ipAddress: ipAddress ?? null,
    });
  } catch (_error) {
    // 活动日志失败不应影响主流程，仅记录
    console.error("Failed to log activity:", _error);
  }
}

/**
 * 列出某邮箱的所有 pending 邀请（用于用户登录后提示"待处理邀请"）。
 */
export async function getPendingInvitationsByEmail({
  email,
}: {
  email: string;
}): Promise<Invitation[]> {
  try {
    return await db
      .select()
      .from(invitation)
      .where(
        and(eq(invitation.email, email), eq(invitation.status, "pending"))
      )
      .orderBy(desc(invitation.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get pending invitations"
    );
  }
}

// ============================================================
// OPC 交易市场：上架申请 / 审核 / 下架 查询函数
// ============================================================

/**
 * 提交上架/下架申请。
 * - 上架(list)：OPC 当前必须为 private 状态，创建 pending 申请，OPC 状态转 pending
 * - 下架(delist)：OPC 当前必须为 listed 状态，创建 pending 申请
 * 同一 OPC 同时只允许一个 pending 申请。
 */
export async function submitListingApplication({
  agentId,
  applicantId,
  type,
  description,
}: {
  agentId: string;
  applicantId: string;
  type: "list" | "delist";
  description?: string;
}): Promise<OpcListingApplication> {
  try {
    return await db.transaction(async (tx) => {
      // 校验 OPC 当前状态
      const [agentRow] = await tx
        .select()
        .from(agent)
        .where(eq(agent.id, agentId))
        .limit(1);

      if (!agentRow) {
        throw new ChatbotError("not_found:agent", "OPC 不存在");
      }

      // 校验申请人是所有者
      // 个人 OPC：仅创建者本人可申请
      // 企业 OPC：仅团队管理员（owner/admin）可申请上架，普通成员无权
      const isPersonalOwner = agentRow.userId === applicantId && agentRow.ownerType === "user";
      let isEnterpriseAdmin = false;
      if (agentRow.ownerType === "enterprise" && agentRow.teamId) {
        const [memberRow] = await tx
          .select({ role: teamMember.role })
          .from(teamMember)
          .where(
            and(
              eq(teamMember.userId, applicantId),
              eq(teamMember.teamId, agentRow.teamId)
            )
          )
          .limit(1);
        isEnterpriseAdmin = memberRow?.role === "owner" || memberRow?.role === "admin";
      }
      if (!isPersonalOwner && !isEnterpriseAdmin) {
        throw new ChatbotError(
          "forbidden:agent",
          "无权限：仅 OPC 所有者或团队管理员可申请上架/下架"
        );
      }

      // 校验状态机
      if (type === "list" && agentRow.listingStatus !== "private") {
        throw new ChatbotError(
          "bad_request:agent",
          "仅私有状态的 OPC 可申请上架"
        );
      }
      if (type === "delist" && agentRow.listingStatus !== "listed") {
        throw new ChatbotError(
          "bad_request:agent",
          "仅已上架的 OPC 可申请下架"
        );
      }

      // 检查是否已有 pending 申请
      const [existPending] = await tx
        .select({ id: opcListingApplication.id })
        .from(opcListingApplication)
        .where(
          and(
            eq(opcListingApplication.agentId, agentId),
            eq(opcListingApplication.status, "pending")
          )
        )
        .limit(1);
      if (existPending) {
        throw new ChatbotError(
          "bad_request:agent",
          "该 OPC 已有待处理的申请"
        );
      }

      // 创建申请
      const [application] = await tx
        .insert(opcListingApplication)
        .values({ agentId, applicantId, type, description })
        .returning();

      // 上架申请：OPC 状态转 pending
      if (type === "list") {
        await tx
          .update(agent)
          .set({ listingStatus: "pending", updatedAt: new Date() })
          .where(eq(agent.id, agentId));
      }

      return application;
    });
  } catch (_error) {
    if (_error instanceof ChatbotError) throw _error;
    console.error("[submitListingApplication] DB error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      `Failed to submit listing application: ${(_error as Error)?.message ?? "unknown"}`
    );
  }
}

/**
 * 撤回上架/下架申请（申请人或团队管理员主动撤回）。
 * 仅 pending 状态可撤回；上架申请撤回后 OPC 状态退回 private。
 * 权限：原申请人本人，或该 OPC 所属团队的 owner/admin。
 */
export async function withdrawListingApplication({
  applicationId,
  applicantId,
}: {
  applicationId: string;
  applicantId: string;
}): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      const [app] = await tx
        .select()
        .from(opcListingApplication)
        .where(eq(opcListingApplication.id, applicationId))
        .limit(1);

      if (!app || app.status !== "pending") {
        throw new ChatbotError(
          "bad_request:database",
          "申请不存在或已处理"
        );
      }

      // 权限检查：申请人本人 或 团队管理员
      const isApplicant = app.applicantId === applicantId;
      let isTeamAdmin = false;
      if (!isApplicant) {
        const [agentRow] = await tx
          .select({ teamId: agent.teamId, ownerType: agent.ownerType })
          .from(agent)
          .where(eq(agent.id, app.agentId))
          .limit(1);

        if (agentRow?.teamId && agentRow.ownerType === "enterprise") {
          const [memberRow] = await tx
            .select({ role: teamMember.role })
            .from(teamMember)
            .where(
              and(
                eq(teamMember.userId, applicantId),
                eq(teamMember.teamId, agentRow.teamId)
              )
            )
            .limit(1);
          isTeamAdmin = memberRow?.role === "owner" || memberRow?.role === "admin";
        }
      }

      if (!isApplicant && !isTeamAdmin) {
        throw new ChatbotError(
          "forbidden:database",
          "无权限撤回他人申请"
        );
      }

      await tx
        .update(opcListingApplication)
        .set({ status: "withdrawn", updatedAt: new Date() })
        .where(eq(opcListingApplication.id, applicationId));

      // 上架申请撤回 → OPC 退回 private
      if (app.type === "list") {
        await tx
          .update(agent)
          .set({ listingStatus: "private", updatedAt: new Date() })
          .where(eq(agent.id, app.agentId));
      }
    });
  } catch (_error) {
    if (_error instanceof ChatbotError) throw _error;
    console.error("[withdrawListingApplication] DB error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      `Failed to withdraw listing application: ${(_error as Error)?.message ?? "unknown"}`
    );
  }
}

/**
 * 管理员审核上架/下架申请。
 * - approved: 上架申请 → OPC 转 public+listed；下架申请 → OPC 转 delisted
 * - rejected: 上架申请 → OPC 退回 private；下架申请 → 保持 listed
 */
export async function reviewListingApplication({
  applicationId,
  reviewerId,
  decision,
  rejectReason,
}: {
  applicationId: string;
  reviewerId: string;
  decision: "approved" | "rejected";
  rejectReason?: string;
}): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      const [app] = await tx
        .select()
        .from(opcListingApplication)
        .where(eq(opcListingApplication.id, applicationId))
        .limit(1);

      if (!app || app.status !== "pending") {
        throw new ChatbotError(
          "bad_request:database",
          "申请不存在或已处理"
        );
      }

      await tx
        .update(opcListingApplication)
        .set({
          status: decision,
          reviewerId,
          rejectReason: decision === "rejected" ? rejectReason : null,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(opcListingApplication.id, applicationId));

      // 同步 OPC 状态
      if (decision === "approved") {
        if (app.type === "list") {
          // 上架通过：转 public + listed
          await tx
            .update(agent)
            .set({
              ownershipType: "public",
              listingStatus: "listed",
              listedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(agent.id, app.agentId));
        } else {
          // 下架通过：转 delisted（已订阅企业可用到周期结束）
          await tx
            .update(agent)
            .set({
              listingStatus: "delisted",
              updatedAt: new Date(),
            })
            .where(eq(agent.id, app.agentId));
        }
      } else {
        // 驳回：上架申请退回 private，下架申请保持 listed
        if (app.type === "list") {
          await tx
            .update(agent)
            .set({ listingStatus: "private", updatedAt: new Date() })
            .where(eq(agent.id, app.agentId));
        }
      }
    });
  } catch (_error) {
    if (_error instanceof ChatbotError) throw _error;
    throw new ChatbotError(
      "bad_request:database",
      "Failed to review listing application"
    );
  }
}

/**
 * 获取待审核的上架/下架申请列表（管理员后台用）。
 */
export async function getPendingListingApplications(): Promise<
  (OpcListingApplication & {
    agentName: string;
    applicantName: string | null;
  })[]
> {
  try {
    const rows = await db
      .select({
        application: opcListingApplication,
        agentName: agent.name,
        applicantName: user.name,
      })
      .from(opcListingApplication)
      .innerJoin(agent, eq(agent.id, opcListingApplication.agentId))
      .innerJoin(user, eq(user.id, opcListingApplication.applicantId))
      .where(eq(opcListingApplication.status, "pending"))
      .orderBy(desc(opcListingApplication.createdAt));

    return rows.map((r) => ({
      ...r.application,
      agentName: r.agentName,
      applicantName: r.applicantName,
    }));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get pending listing applications"
    );
  }
}

/**
 * 获取某用户提交的全部申请（创作者/企业查看自己的申请记录）。
 */
export async function getMyListingApplications({
  applicantId,
}: {
  applicantId: string;
}): Promise<(OpcListingApplication & { agentName: string })[]> {
  try {
    const rows = await db
      .select({
        application: opcListingApplication,
        agentName: agent.name,
      })
      .from(opcListingApplication)
      .innerJoin(agent, eq(agent.id, opcListingApplication.agentId))
      .where(eq(opcListingApplication.applicantId, applicantId))
      .orderBy(desc(opcListingApplication.createdAt));

    return rows.map((r) => ({ ...r.application, agentName: r.agentName }));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get my listing applications"
    );
  }
}

// ============================================================
// OPC 交易市场：商城浏览 / 订阅 / 订单 / 收益 查询函数
// ============================================================

/**
 * 获取商城中所有已上架的公共 OPC（企业浏览雇佣）。
 * 仅返回 listingStatus=listed 的 OPC，按上架时间倒序。
 */
export async function getMarketplaceAgents({
  categoryId,
  search,
}: {
  categoryId?: string | null;
  search?: string | null;
} = {}) {
  try {
    const conditions = [eq(agent.listingStatus, "listed"), eq(agent.isActive, true)];
    if (categoryId) {
      conditions.push(eq(agent.categoryId, categoryId));
    }
    if (search) {
      conditions.push(
        or(
          ilike(agent.name, `%${search}%`),
          ilike(agent.description, `%${search}%`)
        )!
      );
    }

    return await db
      .select()
      .from(agent)
      .where(and(...conditions))
      .orderBy(desc(agent.listedAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get marketplace agents"
    );
  }
}

/**
 * 创建订阅订单（企业订阅公共 OPC）。
 * 流程：校验 OPC 已上架 + 企业未重复订阅 → 生成订单(pending) → 返回订单号
 * 实际支付由 Stripe checkout 完成，webhook 激活后调用 activateSubscription。
 */
export async function createOpcOrder({
  enterpriseId,
  userId,
  agentId,
  period,
  ownerRevenuePercent = 70,
}: {
  enterpriseId: string;
  userId: string;
  agentId: string;
  period: "monthly" | "yearly";
  ownerRevenuePercent?: number;
}): Promise<{ order: OpcOrder; agent: typeof agent.$inferSelect }> {
  try {
    return await db.transaction(async (tx) => {
      // 校验 OPC 已上架
      const [agentRow] = await tx
        .select()
        .from(agent)
        .where(eq(agent.id, agentId))
        .limit(1);

      if (!agentRow || agentRow.listingStatus !== "listed") {
        throw new ChatbotError(
          "bad_request:agent",
          "OPC 不存在或未上架"
        );
      }

      // 校验企业未重复订阅（active 状态）
      const [existSub] = await tx
        .select({ id: opcSubscription.id })
        .from(opcSubscription)
        .where(
          and(
            eq(opcSubscription.enterpriseId, enterpriseId),
            eq(opcSubscription.agentId, agentId),
            eq(opcSubscription.status, "active")
          )
        )
        .limit(1);
      if (existSub) {
        throw new ChatbotError(
          "bad_request:database",
          "你的企业已订阅该 OPC"
        );
      }

      const amount =
        period === "monthly" ? agentRow.priceMonthly : agentRow.priceYearly;
      const orderNo = `OPC${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

      const [order] = await tx
        .insert(opcOrder)
        .values({
          orderNo,
          enterpriseId,
          userId,
          agentId,
          period,
          amount,
          ownerRevenuePercent,
          paymentStatus: "pending",
        })
        .returning();

      return { order, agent: agentRow };
    });
  } catch (_error) {
    if (_error instanceof ChatbotError) throw _error;
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create OPC order"
    );
  }
}

/**
 * 订单支付成功后激活订阅（webhook 调用）。
 * 流程：更新订单 paymentStatus=paid → 创建/续期 opcSubscription → 写入 opcRevenue 收益记录
 */
export async function activateSubscription({
  orderId,
  stripePaymentIntentId,
}: {
  orderId: string;
  stripePaymentIntentId?: string;
}): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(opcOrder)
        .where(eq(opcOrder.id, orderId))
        .limit(1);

      if (!order || order.paymentStatus === "paid") {
        return; // 订单不存在或已处理
      }

      // 更新订单为已支付
      await tx
        .update(opcOrder)
        .set({
          paymentStatus: "paid",
          paidAt: new Date(),
          stripePaymentIntentId: stripePaymentIntentId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(opcOrder.id, orderId));

      // 计算订阅周期
      const startDate = new Date();
      const endDate = new Date(startDate);
      if (order.period === "monthly") {
        endDate.setMonth(endDate.getMonth() + 1);
      } else {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      // 若已有过期订阅则续期，否则新建
      const [existSub] = await tx
        .select()
        .from(opcSubscription)
        .where(
          and(
            eq(opcSubscription.enterpriseId, order.enterpriseId),
            eq(opcSubscription.agentId, order.agentId)
          )
        )
        .limit(1);

      if (existSub) {
        // 续期：从当前到期时间或现在开始延后
        const baseDate =
          existSub.status === "active" && existSub.endDate > startDate
            ? existSub.endDate
            : startDate;
        const newEnd = new Date(baseDate);
        if (order.period === "monthly") {
          newEnd.setMonth(newEnd.getMonth() + 1);
        } else {
          newEnd.setFullYear(newEnd.getFullYear() + 1);
        }
        await tx
          .update(opcSubscription)
          .set({
            status: "active",
            startDate: existSub.status === "active" ? existSub.startDate : startDate,
            endDate: newEnd,
            amount: order.amount,
            orderId: order.id,
            period: order.period,
            ownerRevenuePercent: order.ownerRevenuePercent,
            updatedAt: new Date(),
          })
          .where(eq(opcSubscription.id, existSub.id));
      } else {
        // 新建订阅：同时复制一份 OPC 副本供企业独立编辑
        const [sourceAgent] = await tx
          .select()
          .from(agent)
          .where(eq(agent.id, order.agentId))
          .limit(1);

        let clonedAgentId: string | null = null;
        if (sourceAgent) {
          const [cloned] = await tx
            .insert(agent)
            .values({
              name: sourceAgent.name,
              description: sourceAgent.description,
              avatar: sourceAgent.avatar,
              systemPrompt: sourceAgent.systemPrompt,
              phone: sourceAgent.phone,
              knowledgeId: sourceAgent.knowledgeId,
              starterQuestions: sourceAgent.starterQuestions,
              isActive: true,
              sortOrder: 999,
              categoryId: sourceAgent.categoryId,
              userId: order.userId,
              visibility: "private",
              teamId: null, // 副本不归属团队，通过 ownerEnterpriseId 关联企业
              ownershipType: "enterprise_private",
              ownerType: "enterprise",
              ownerEnterpriseId: order.enterpriseId,
              listingStatus: "private",
              priceMonthly: 0,
              priceYearly: 0,
              sourceAgentId: sourceAgent.id,
            })
            .returning();
          clonedAgentId = cloned.id;
        }

        const [newSub] = await tx.insert(opcSubscription).values({
          enterpriseId: order.enterpriseId,
          agentId: order.agentId,
          clonedAgentId,
          orderId: order.id,
          period: order.period,
          amount: order.amount,
          ownerRevenuePercent: order.ownerRevenuePercent,
          status: "active",
          startDate,
          endDate,
        }).returning();

        // 续期场景也需要更新 existSub 的 clonedAgentId
        if (existSub) {
          await tx
            .update(opcSubscription)
            .set({ clonedAgentId })
            .where(eq(opcSubscription.id, existSub.id));
        }
      }

      // 写入收益分成记录（归属 OPC 所有者）
      const [agentRow] = await tx
        .select()
        .from(agent)
        .where(eq(agent.id, order.agentId))
        .limit(1);

      if (agentRow) {
        const revenueAmount = Math.floor(
          (order.amount * order.ownerRevenuePercent) / 100
        );
        await tx.insert(opcRevenue).values({
          ownerId: agentRow.ownerType === "user" ? agentRow.userId : null,
          ownerType: agentRow.ownerType,
          subscriptionId: existSub?.id ?? null,
          orderId: order.id,
          agentId: order.agentId,
          enterpriseId: order.enterpriseId,
          orderAmount: order.amount,
          revenuePercent: order.ownerRevenuePercent,
          revenueAmount,
          settleStatus: "pending",
        });
      }
    });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to activate subscription"
    );
  }
}

/**
 * 获取企业已订阅的 OPC 列表（企业资产池）。
 */
export async function getEnterpriseSubscriptions({
  enterpriseId,
}: {
  enterpriseId: string;
}) {
  try {
    const rows = await db
      .select({
        subscription: opcSubscription,
        agentName: agent.name,
        agentAvatar: agent.avatar,
        agentDescription: agent.description,
        agentSystemPrompt: agent.systemPrompt,
        agentStarterQuestions: agent.starterQuestions,
        agentKnowledgeId: agent.knowledgeId,
      })
      .from(opcSubscription)
      .innerJoin(agent, eq(agent.id, opcSubscription.agentId))
      .where(eq(opcSubscription.enterpriseId, enterpriseId))
      .orderBy(desc(opcSubscription.createdAt));

    return rows;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get enterprise subscriptions"
    );
  }
}

/**
 * 获取某 OPC 的订阅企业数与活跃订阅数（创作者收益中心用）。
 */
export async function getAgentSubscriptionStats({
  agentId,
}: {
  agentId: string;
}) {
  try {
    const activeSubs = await db
      .select()
      .from(opcSubscription)
      .where(
        and(
          eq(opcSubscription.agentId, agentId),
          eq(opcSubscription.status, "active")
        )
      );

    const totalRevenue = await db
      .select({
        total: sum(opcRevenue.revenueAmount),
      })
      .from(opcRevenue)
      .where(eq(opcRevenue.agentId, agentId));

    return {
      activeCount: activeSubs.length,
      activeSubscriptions: activeSubs,
      totalRevenue: totalRevenue[0]?.total ?? 0,
    };
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get agent subscription stats"
    );
  }
}

// ============================================================
// OPC 交易市场：创作者收益中心查询函数
// ============================================================

/**
 * 获取创作者名下全部 OPC 及其订阅/收益统计。
 * 用于创作者后台资产中心展示。
 */
export async function getCreatorOpcStats({
  userId,
}: {
  userId: string;
}) {
  try {
    // 创作者名下所有 OPC（个人私有 + 已上架公共）
    const myAgents = await db
      .select()
      .from(agent)
      .where(eq(agent.userId, userId))
      .orderBy(desc(agent.createdAt));

    // 批量查询每个 OPC 的订阅数与收益
    const result = await Promise.all(
      myAgents.map(async (a) => {
        const [activeCountRow] = await db
          .select({ count: count() })
          .from(opcSubscription)
          .where(
            and(
              eq(opcSubscription.agentId, a.id),
              eq(opcSubscription.status, "active")
            )
          );

        const [revenueRow] = await db
          .select({ total: sum(opcRevenue.revenueAmount) })
          .from(opcRevenue)
          .where(
            and(
              eq(opcRevenue.agentId, a.id),
              eq(opcRevenue.ownerId, userId)
            )
          );

        return {
          ...a,
          activeSubscriberCount: activeCountRow?.count ?? 0,
          totalRevenue: revenueRow?.total ?? 0,
        };
      })
    );

    return result;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get creator OPC stats"
    );
  }
}

/**
 * 获取创作者的收益明细列表（按时间倒序）。
 * 用于创作者后台收益明细页。
 */
export async function getCreatorRevenueList({
  userId,
  limit = 50,
}: {
  userId: string;
  limit?: number;
}) {
  try {
    const rows = await db
      .select({
        revenue: opcRevenue,
        agentName: agent.name,
        enterpriseName: enterprise.name,
      })
      .from(opcRevenue)
      .innerJoin(agent, eq(agent.id, opcRevenue.agentId))
      .leftJoin(enterprise, eq(enterprise.id, opcRevenue.enterpriseId))
      .where(eq(opcRevenue.ownerId, userId))
      .orderBy(desc(opcRevenue.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      ...r.revenue,
      agentName: r.agentName,
      enterpriseName: r.enterpriseName,
    }));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get creator revenue list"
    );
  }
}

/**
 * 获取创作者收益汇总（总收益、本月收益、OPC 数、总订阅数）。
 */
export async function getCreatorRevenueSummary({
  userId,
}: {
  userId: string;
}) {
  try {
    const [totalRow] = await db
      .select({ total: sum(opcRevenue.revenueAmount) })
      .from(opcRevenue)
      .where(eq(opcRevenue.ownerId, userId));

    // 本月收益
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [monthRow] = await db
      .select({ total: sum(opcRevenue.revenueAmount) })
      .from(opcRevenue)
      .where(
        and(
          eq(opcRevenue.ownerId, userId),
          gte(opcRevenue.createdAt, monthStart)
        )
      );

    // OPC 数量
    const [opcCountRow] = await db
      .select({ count: count() })
      .from(agent)
      .where(eq(agent.userId, userId));

    // 总订阅数（所有名下 OPC 的活跃订阅）
    const myAgentIds = await db
      .select({ id: agent.id })
      .from(agent)
      .where(eq(agent.userId, userId));
    const agentIdList = myAgentIds.map((a) => a.id);

    let totalSubscriptions = 0;
    if (agentIdList.length > 0) {
      const [subRow] = await db
        .select({ count: count() })
        .from(opcSubscription)
        .where(
          and(
            inArray(opcSubscription.agentId, agentIdList),
            eq(opcSubscription.status, "active")
          )
        );
      totalSubscriptions = subRow?.count ?? 0;
    }

    return {
      totalRevenue: totalRow?.total ?? 0,
      monthRevenue: monthRow?.total ?? 0,
      opcCount: opcCountRow?.count ?? 0,
      totalSubscriptions,
    };
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get creator revenue summary"
    );
  }
}

// ============================================================
// OPC 交易市场：平台管理员后台查询函数
// ============================================================

/**
 * 获取全部订单列表（管理员后台交易流水）。
 * 支持按支付状态过滤，按时间倒序。
 */
export async function getAllOrders({
  paymentStatus,
  limit = 100,
}: {
  paymentStatus?: "pending" | "paid" | "refunded" | "failed";
  limit?: number;
} = {}) {
  try {
    const conditions = paymentStatus
      ? [eq(opcOrder.paymentStatus, paymentStatus)]
      : [];

    const rows = await db
      .select({
        order: opcOrder,
        agentName: agent.name,
        enterpriseName: enterprise.name,
        userEmail: user.email,
      })
      .from(opcOrder)
      .innerJoin(agent, eq(agent.id, opcOrder.agentId))
      .innerJoin(enterprise, eq(enterprise.id, opcOrder.enterpriseId))
      .innerJoin(user, eq(user.id, opcOrder.userId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(opcOrder.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      ...r.order,
      agentName: r.agentName,
      enterpriseName: r.enterpriseName,
      userEmail: r.userEmail,
    }));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get all orders"
    );
  }
}

/**
 * 获取全部用户列表（管理员后台用户管理）。
 * 含订阅套餐（teamMember → team）与企业名称（enterprise）。
 * 平台管理员可查看所有用户；企业管理员仅查看所属企业用户；个人管理员查看非企业用户。
 */
export async function getAllUsers({
  accountType,
  limit = 100,
}: {
  accountType?: "personal" | "enterprise";
  limit?: number;
} = {}) {
  try {
    const conditions = accountType
      ? [eq(user.accountType, accountType)]
      : [];

    const rows = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        accountType: user.accountType,
        enterpriseId: user.enterpriseId,
        role: user.role,
        phone: user.phone,
        bannedAt: user.bannedAt,
        bannedReason: user.bannedReason,
        createdAt: user.createdAt,
        // 订阅套餐（通过 teamMember → team 关联）
        planName: team.planName,
        subscriptionStatus: team.subscriptionStatus,
        // 企业名称（通过 enterprise 关联）
        enterpriseName: enterprise.name,
        enterpriseVerifyStatus: enterprise.verifyStatus,
      })
      .from(user)
      .leftJoin(teamMember, eq(teamMember.userId, user.id))
      .leftJoin(team, eq(team.id, teamMember.teamId))
      .leftJoin(enterprise, eq(enterprise.id, user.enterpriseId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(user.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      image: r.image,
      accountType: r.accountType,
      enterpriseId: r.enterpriseId,
      role: r.role,
      phone: r.phone,
      bannedAt: r.bannedAt,
      bannedReason: r.bannedReason,
      createdAt: r.createdAt,
      planName: r.planName ?? "free",
      subscriptionStatus: r.subscriptionStatus,
      enterpriseName: r.enterpriseName,
      enterpriseVerifyStatus: r.enterpriseVerifyStatus,
    }));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get all users"
    );
  }
}

/**
 * 平台管理员更新用户类型与套餐。
 * 可更新：role（角色）、accountType（账号类型）、planName（订阅套餐）。
 */
export async function updateUserByAdmin({
  userId,
  role,
  accountType,
  planName,
}: {
  userId: string;
  role?: "admin" | "user";
  accountType?: "personal" | "enterprise";
  planName?: "free" | "base" | "plus";
}) {
  try {
    // 更新用户角色与账号类型
    if (role !== undefined || accountType !== undefined) {
      const userUpdate: Record<string, unknown> = { updatedAt: new Date() };
      if (role !== undefined) userUpdate.role = role;
      if (accountType !== undefined) userUpdate.accountType = accountType;
      await db.update(user).set(userUpdate).where(eq(user.id, userId));
    }

    // 更新订阅套餐（通过 teamMember → team）
    if (planName !== undefined) {
      const [membership] = await db
        .select({ teamId: teamMember.teamId })
        .from(teamMember)
        .where(eq(teamMember.userId, userId))
        .limit(1);

      if (membership) {
        await db
          .update(team)
          .set({
            planName,
            subscriptionStatus: "active",
            updatedAt: new Date(),
          })
          .where(eq(team.id, membership.teamId));
      }
    }
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update user"
    );
  }
}

/**
 * 获取待审核企业资质列表（管理员后台）。
 */
export async function getPendingEnterprises() {
  try {
    return await db
      .select()
      .from(enterprise)
      .where(eq(enterprise.verifyStatus, "pending"))
      .orderBy(desc(enterprise.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get pending enterprises"
    );
  }
}

/**
 * 管理员审核企业资质。
 */
export async function reviewEnterpriseVerification({
  enterpriseId,
  reviewerId,
  decision,
  rejectReason,
}: {
  enterpriseId: string;
  reviewerId: string;
  decision: "verified" | "rejected";
  rejectReason?: string;
}): Promise<void> {
  try {
    await db
      .update(enterprise)
      .set({
        verifyStatus: decision,
        verifyRejectReason: decision === "rejected" ? rejectReason : null,
        verifiedBy: reviewerId,
        verifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(enterprise.id, enterpriseId));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to review enterprise verification"
    );
  }
}

/**
 * 管理员强制下架 OPC（风控）。
 * OPC 转 delisted，已订阅企业可用到周期结束。
 * 记录下架审计信息（谁、何时、为何），便于后续恢复与追溯。
 */
export async function forceDelistOpc({
  agentId,
  reviewerId,
  reason,
}: {
  agentId: string;
  reviewerId: string;
  reason?: string;
}): Promise<void> {
  try {
    await db
      .update(agent)
      .set({
        listingStatus: "delisted",
        delistedAt: new Date(),
        delistedBy: reviewerId,
        delistReason: reason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(agent.id, agentId));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to force delist OPC"
    );
  }
}

/**
 * 管理员恢复已下架的 OPC（重新上架）。
 * 将 delisted 状态恢复为 listed，清除下架审计字段。
 * 恢复后 OPC 重新对全站可见，已订阅企业继续可用。
 */
export async function restoreOpc({
  agentId,
  reviewerId,
}: {
  agentId: string;
  reviewerId: string;
}): Promise<void> {
  try {
    await db
      .update(agent)
      .set({
        listingStatus: "listed",
        delistedAt: null,
        delistedBy: null,
        delistReason: null,
        updatedAt: new Date(),
      })
      .where(eq(agent.id, agentId));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to restore OPC"
    );
  }
}

/**
 * 管理员封禁用户账号（风控）。
 */
export async function banUser({
  userId,
  reason,
}: {
  userId: string;
  reason: string;
}): Promise<void> {
  try {
    await db
      .update(user)
      .set({
        bannedAt: new Date(),
        bannedReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to ban user"
    );
  }
}

/**
 * 管理员解封用户账号。
 */
export async function unbanUser({
  userId,
}: {
  userId: string;
}): Promise<void> {
  try {
    await db
      .update(user)
      .set({
        bannedAt: null,
        bannedReason: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to unban user"
    );
  }
}

/**
 * 获取平台总览统计（管理员仪表盘）。
 */
export async function getAdminOverviewStats() {
  try {
    const [userCount] = await db
      .select({ count: count() })
      .from(user);

    const [enterpriseCount] = await db
      .select({ count: count() })
      .from(enterprise)
      .where(eq(enterprise.verifyStatus, "verified"));

    const [listedOpcCount] = await db
      .select({ count: count() })
      .from(agent)
      .where(eq(agent.listingStatus, "listed"));

    const [pendingAppCount] = await db
      .select({ count: count() })
      .from(opcListingApplication)
      .where(eq(opcListingApplication.status, "pending"));

    const [paidOrderCount] = await db
      .select({ count: count() })
      .from(opcOrder)
      .where(eq(opcOrder.paymentStatus, "paid"));

    const [totalRevenueRow] = await db
      .select({ total: sum(opcOrder.amount) })
      .from(opcOrder)
      .where(eq(opcOrder.paymentStatus, "paid"));

    return {
      userCount: userCount?.count ?? 0,
      enterpriseCount: enterpriseCount?.count ?? 0,
      listedOpcCount: listedOpcCount?.count ?? 0,
      pendingAppCount: pendingAppCount?.count ?? 0,
      paidOrderCount: paidOrderCount?.count ?? 0,
      totalRevenue: totalRevenueRow?.total ?? 0,
    };
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get admin overview stats"
    );
  }
}

