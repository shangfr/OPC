import { cache } from "react";
import { eq, and } from "drizzle-orm";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db/queries";
import { team, teamMember, user, type Team } from "@/lib/db/schema";

/**
 * SaaS 多租户：团队上下文工具
 *
 * 设计思路（替代 saas-starter 的 JWT/Cookie 认证）：
 * - opcbot 坚持使用 Auth.js v5，登录态由 Auth.js session 管理
 * - 当前团队 ID 持久化在 Auth.js 的 JWT token 中（session.user.teamId）
 * - 切换团队通过 Server Action 更新 token（见 lib/teams/actions.ts 的 switchTeam）
 * - 所有业务查询通过 getCurrentTeam() 拿到 teamId 后再加 WHERE teamId = ? 过滤
 */

export type TeamWithRole = Team & { role: "owner" | "admin" | "member" };

/**
 * 获取当前登录用户在当前团队中的成员记录（含角色）。
 * 同时校验：用户必须是该团队的成员，否则返回 null（实现租户隔离）。
 *
 * 使用 React cache 保证单次请求内只查一次。
 */
export const getCurrentTeamMember = cache(async () => {
  const session = await auth();
  if (!session?.user?.id || !session.user.teamId) {
    return null;
  }

  const [member] = await db
    .select()
    .from(teamMember)
    .where(
      and(
        eq(teamMember.teamId, session.user.teamId),
        eq(teamMember.userId, session.user.id)
      )
    )
    .limit(1);

  return member ?? null;
});

/**
 * 获取当前团队（含当前用户在该团队中的角色）。
 * 若用户未登录或未选择团队，返回 null。
 */
export const getCurrentTeam = cache(async (): Promise<TeamWithRole | null> => {
  const session = await auth();
  if (!session?.user?.id || !session.user.teamId) {
    return null;
  }

  const [row] = await db
    .select({
      team,
      role: teamMember.role,
    })
    .from(team)
    .innerJoin(
      teamMember,
      and(
        eq(teamMember.teamId, team.id),
        eq(teamMember.userId, session.user.id)
      )
    )
    .where(eq(team.id, session.user.teamId))
    .limit(1);

  if (!row) {
    return null;
  }

  return { ...row.team, role: row.role };
});

/**
 * 获取当前团队 ID（便捷方法）。
 * 优先读 session.user.teamId；若为空则尝试返回用户的第一个团队。
 */
export const getCurrentTeamId = cache(async (): Promise<string | null> => {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  if (session.user.teamId) {
    return session.user.teamId;
  }

  // token 中无 teamId：回退到用户加入的第一个团队
  const [first] = await db
    .select({ teamId: teamMember.teamId })
    .from(teamMember)
    .where(eq(teamMember.userId, session.user.id))
    .limit(1);

  return first?.teamId ?? null;
});

/**
 * 列出当前用户加入的所有团队（用于团队切换器下拉菜单）。
 */
export const listUserTeams = cache(async (): Promise<TeamWithRole[]> => {
  const session = await auth();
  if (!session?.user?.id) {
    return [];
  }

  const rows = await db
    .select({ team, role: teamMember.role })
    .from(teamMember)
    .innerJoin(team, eq(team.id, teamMember.teamId))
    .where(eq(teamMember.userId, session.user.id));

  return rows.map((r) => ({ ...r.team, role: r.role }));
});

/**
 * 列出当前团队的所有成员（用于团队设置页成员管理）。
 * 仅返回当前用户所在团队的成员列表。
 */
export const getTeamMembers = cache(
  async (): Promise<
    {
      userId: string;
      email: string;
      name: string | null;
      role: "owner" | "admin" | "member";
    }[]
  > => {
    const session = await auth();
    if (!session?.user?.id || !session.user.teamId) {
      return [];
    }

    const rows = await db
      .select({
        userId: teamMember.userId,
        email: user.email,
        name: user.name,
        role: teamMember.role,
      })
      .from(teamMember)
      .innerJoin(user, eq(user.id, teamMember.userId))
      .where(eq(teamMember.teamId, session.user.teamId));

    return rows;
  }
);
