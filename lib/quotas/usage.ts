import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/queries";
import { team } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";

/**
 * SaaS 配额管理：消息数/月 限制
 *
 * 设计：
 * - team 表的 maxMessages 字段标记当前套餐额度（null = 无限）
 * - team 表的 usedMessages 字段累加本月已用消息数
 * - usageResetAt 标记上次重置时间；订阅周期变更（webhook）或月初时重置
 *
 * 拦截点：/api/chat 处理用户消息前调用 checkAndIncrementMessageQuota
 */

/**
 * 检查团队本月消息配额是否超限，超限则抛出 ChatbotError("rate_limit:quota")。
 * 同时处理按月重置：若 usageResetAt 距今超过 30 天，先重置 usedMessages。
 *
 * @param teamId 当前团队 ID（从 session.user.teamId 获取）
 * @throws ChatbotError 配额超限时抛出，前端引导去 /pricing 升级
 */
export async function checkMessageQuota(teamId: string | null) {
  if (!teamId) {
    // 无团队（如游客）：不限制，由原有的 rate_limit:chat 按小时限流兜底
    return;
  }

  const [teamRecord] = await db
    .select({
      maxMessages: team.maxMessages,
      usedMessages: team.usedMessages,
      usageResetAt: team.usageResetAt,
      subscriptionEnd: team.subscriptionEnd,
    })
    .from(team)
    .where(eq(team.id, teamId))
    .limit(1);

  if (!teamRecord) {
    // 团队不存在：放行，由后续业务逻辑处理
    return;
  }

  // 无限套餐（maxMessages = null）：不限制
  if (teamRecord.maxMessages === null) {
    return;
  }

  // 按月重置：usageResetAt 超过 30 天，或订阅周期已结束
  const now = new Date();
  const shouldReset =
    !teamRecord.usageResetAt ||
    now.getTime() - teamRecord.usageResetAt.getTime() > 30 * 24 * 60 * 60 * 1000 ||
    (teamRecord.subscriptionEnd !== null &&
      now.getTime() > teamRecord.subscriptionEnd.getTime());

  if (shouldReset) {
    await db
      .update(team)
      .set({ usedMessages: 0, usageResetAt: now })
      .where(eq(team.id, teamId));
    return; // 重置后本次放行
  }

  // 配额检查
  if (teamRecord.usedMessages >= teamRecord.maxMessages) {
    throw new ChatbotError(
      "rate_limit:quota",
      `本月消息配额已用完（${teamRecord.usedMessages}/${teamRecord.maxMessages}）。请升级套餐后继续使用。`
    );
  }
}

/**
 * 累加团队本月已用消息数（+1）。
 * 在 AI 回复成功生成后调用，避免失败消息也计入配额。
 */
export async function incrementMessageUsage(teamId: string | null) {
  if (!teamId) return;

  await db
    .update(team)
    .set({
      usedMessages: sql`${team.usedMessages} + 1`,
    })
    .where(eq(team.id, teamId));
}

/**
 * 获取团队当前配额使用情况（用于设置页展示进度条）。
 */
export async function getTeamUsage(teamId: string) {
  const [teamRecord] = await db
    .select({
      planName: team.planName,
      maxMessages: team.maxMessages,
      usedMessages: team.usedMessages,
      usageResetAt: team.usageResetAt,
      subscriptionStatus: team.subscriptionStatus,
      subscriptionEnd: team.subscriptionEnd,
    })
    .from(team)
    .where(eq(team.id, teamId))
    .limit(1);

  return teamRecord ?? null;
}
