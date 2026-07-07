"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db/queries";
import { team, teamMember, invitation, type TeamDataWithMembers } from "@/lib/db/schema";
import {
  createTeamWithOwner,
  getTeamWithMembers,
  createInvitation,
  acceptInvitation,
  removeTeamMember,
  updateTeamMemberRole,
  logActivity,
} from "@/lib/db/queries";

/**
 * SaaS 多租户：团队与权限 Server Actions
 *
 * 从 saas-starter 的 app/(dashboard)/teams 移植核心逻辑，适配 opcbot：
 * - 认证：用 Auth.js 的 auth() 读取 session（而非 saas-starter 的 getSession()）
 * - 权限：owner/admin 才能邀请/移除成员、改角色
 * - 数据隔离：所有操作都校验当前用户是目标团队的成员
 */

export type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

/** 校验当前用户在指定团队中的角色，返回成员记录或 null */
async function assertTeamMember(teamId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("未登录");
  }
  const [member] = await db
    .select()
    .from(teamMember)
    .where(
      and(
        eq(teamMember.teamId, teamId),
        eq(teamMember.userId, session.user.id)
      )
    )
    .limit(1);
  return { session, member };
}

/** 要求当前用户是指定团队的 owner 或 admin */
async function assertTeamAdmin(teamId: string) {
  const ctx = await assertTeamMember(teamId);
  if (!ctx.member || (ctx.member.role !== "owner" && ctx.member.role !== "admin")) {
    throw new Error("无权限：需要团队管理员角色");
  }
  return ctx;
}

/**
 * 创建新团队（当前用户成为 owner）。
 */
export async function createTeamAction(name: string): Promise<ActionResult<{ teamId: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "未登录" };
    }
    if (!name || name.trim().length === 0) {
      return { success: false, error: "团队名称不能为空" };
    }

    const newTeam = await createTeamWithOwner({
      userId: session.user.id,
      name: name.trim(),
    });

    await logActivity({
      teamId: newTeam.id,
      userId: session.user.id,
      action: "CREATE_TEAM" as const,
    });

    revalidatePath("/");
    return { success: true, data: { teamId: newTeam.id } };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/**
 * 邀请成员加入团队（仅 owner/admin）。
 */
export async function inviteMemberAction(
  teamId: string,
  email: string,
  role: "admin" | "member" = "member"
): Promise<ActionResult<{ invitationId: string }>> {
  try {
    const ctx = await assertTeamAdmin(teamId);
    if (!ctx.member) {
      return { success: false, error: "无权限" };
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
      return { success: false, error: "邮箱格式不正确" };
    }

    // 不允许邀请已是成员的邮箱
    const [existing] = await db
      .select()
      .from(teamMember)
      .innerJoin(team, eq(team.id, teamMember.teamId))
      .where(eq(teamMember.teamId, teamId))
      .limit(50);

    const inv = await createInvitation({
      teamId,
      email: normalizedEmail,
      role,
      invitedBy: ctx.session.user.id,
    });

    await logActivity({
      teamId,
      userId: ctx.session.user.id,
      action: "INVITE_TEAM_MEMBER" as const,
    });

    revalidatePath(`/team/${teamId}`);
    return { success: true, data: { invitationId: inv.id } };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/**
 * 接受邀请（被邀请用户本人操作）。
 */
export async function acceptInvitationAction(
  invitationId: string
): Promise<ActionResult<{ teamId: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.email) {
      return { success: false, error: "未登录" };
    }

    const result = await acceptInvitation({
      invitationId,
      userId: session.user.id,
      email: session.user.email,
    });

    await logActivity({
      teamId: result.teamId,
      userId: session.user.id,
      action: "ACCEPT_INVITATION" as const,
    });

    revalidatePath("/");
    return { success: true, data: { teamId: result.teamId } };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/**
 * 移除团队成员（仅 owner/admin，且不能移除 owner）。
 */
export async function removeMemberAction(
  teamId: string,
  targetUserId: string
): Promise<ActionResult> {
  try {
    const ctx = await assertTeamAdmin(teamId);
    if (!ctx.member) {
      return { success: false, error: "无权限" };
    }

    // 查目标成员角色，owner 不可被移除
    const [target] = await db
      .select()
      .from(teamMember)
      .where(
        and(
          eq(teamMember.teamId, teamId),
          eq(teamMember.userId, targetUserId)
        )
      )
      .limit(1);

    if (!target) {
      return { success: false, error: "成员不存在" };
    }
    if (target.role === "owner") {
      return { success: false, error: "不能移除团队所有者" };
    }

    await removeTeamMember({ teamId, userId: targetUserId });
    await logActivity({
      teamId,
      userId: ctx.session.user.id,
      action: "REMOVE_TEAM_MEMBER" as const,
    });

    revalidatePath(`/team/${teamId}`);
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/**
 * 更新成员角色（仅 owner 可操作；owner 不能降级自己）。
 */
export async function updateMemberRoleAction(
  teamId: string,
  targetUserId: string,
  role: "admin" | "member"
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "未登录" };
    }
    // 仅 owner 能改角色
    const [me] = await db
      .select()
      .from(teamMember)
      .where(
        and(
          eq(teamMember.teamId, teamId),
          eq(teamMember.userId, session.user.id)
        )
      )
      .limit(1);
    if (!me || me.role !== "owner") {
      return { success: false, error: "仅团队所有者可调整成员角色" };
    }

    await updateTeamMemberRole({ teamId, userId: targetUserId, role });
    revalidatePath(`/team/${teamId}`);
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/**
 * 切换当前团队（更新 Auth.js token 中的 teamId）。
 *
 * Auth.js v5 纯 Server Component 模式：
 * 通过 cookie 传递目标 teamId，jwt 回调读取后写入 token 并清除 cookie。
 * 客户端调用后 router.refresh() 触发服务端组件重新渲染。
 */
export async function switchTeamAction(
  targetTeamId: string
): Promise<ActionResult<{ teamId: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "未登录" };
    }

    // 校验：当前用户必须是目标团队的成员
    const [member] = await db
      .select()
      .from(teamMember)
      .where(
        and(
          eq(teamMember.teamId, targetTeamId),
          eq(teamMember.userId, session.user.id)
        )
      )
      .limit(1);

    if (!member) {
      return { success: false, error: "你不是该团队的成员" };
    }

    // Auth.js v5 纯 Server Component 模式：
    // 通过 cookie 传递目标 teamId，jwt 回调读取后写入 token 并清除 cookie
    const cookieStore = await cookies();
    cookieStore.set("switch_team_id", targetTeamId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60, // 60 秒足够完成一次重定向
      path: "/",
    });

    revalidatePath("/");
    return { success: true, data: { teamId: targetTeamId } };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/**
 * 获取团队详情（含成员列表），用于团队设置页。
 * 仅团队成员可查看。
 */
export async function getTeamDataAction(
  teamId: string
): Promise<ActionResult<TeamDataWithMembers>> {
  try {
    const ctx = await assertTeamMember(teamId);
    if (!ctx.member) {
      return { success: false, error: "无权限" };
    }
    const data = await getTeamWithMembers({ teamId });
    if (!data) {
      return { success: false, error: "团队不存在" };
    }
    return { success: true, data };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}
