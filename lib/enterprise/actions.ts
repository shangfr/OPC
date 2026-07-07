"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db/queries";
import {
  enterprise,
  user,
  team,
  teamMember,
  type Enterprise,
} from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import { generateHashedPassword } from "@/lib/db/utils";

/**
 * OPC 交易市场：企业（2B）账号体系 Server Actions
 *
 * 设计：
 * - 企业注册：创建 enterprise 记录 + 把当前用户升级为 enterprise 账号（owner/企业管理员）
 * - 企业资质认证：提交营业执照等材料，状态 unverified → pending → verified/rejected
 * - 团队个人账号：企业管理员在团队功能里创建/邀请成员，成员账号 accountType 保持 personal，
 *   登录后功能与注册个人账号一致（有知识库、创作者中心，无团队管理功能）
 * - 个人账号（2C）默认 accountType=personal，无团队功能，可申请升级企业账号获得团队功能
 */

export type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * 注册企业（当前个人用户升级为企业所有者）。
 * 流程：创建 enterprise 记录 → 更新 user.accountType=enterprise + enterpriseId
 * → 自动创建企业团队（owner 角色）。
 */
export async function registerEnterpriseAction(input: {
  name: string;
  creditCode: string;
  contactName: string;
  contactPhone: string;
  licenseImage?: string | null;
}): Promise<ActionResult<Enterprise>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "未登录" };
    }
    if (session.user.accountType === "enterprise") {
      return { success: false, error: "你已是企业账号" };
    }

    // 校验信用代码唯一
    const [exist] = await db
      .select({ id: enterprise.id })
      .from(enterprise)
      .where(eq(enterprise.creditCode, input.creditCode))
      .limit(1);
    if (exist) {
      return { success: false, error: "该统一社会信用代码已被注册" };
    }

    const result = await db.transaction(async (tx) => {
      // 1. 创建企业记录（认证状态默认 unverified，需提交资质后变 pending）
      const [ent] = await tx
        .insert(enterprise)
        .values({
          name: input.name,
          creditCode: input.creditCode,
          contactName: input.contactName,
          contactPhone: input.contactPhone,
          licenseImage: input.licenseImage ?? null,
          verifyStatus: "unverified",
          ownerId: session.user.id,
        })
        .returning();

      // 2. 升级当前用户为企业账号
      await tx
        .update(user)
        .set({
          accountType: "enterprise",
          enterpriseId: ent.id,
          updatedAt: new Date(),
        })
        .where(eq(user.id, session.user.id));

      // 3. 自动创建企业团队（复用 SaaS 多租户的 team 体系）
      const [newTeam] = await tx
        .insert(team)
        .values({
          name: `${input.name} 团队`,
          ownerId: session.user.id,
          planName: "free",
          maxMessages: 100,
          maxMembers: 10,
          usedMessages: 0,
          usageResetAt: new Date(),
        })
        .returning();

      await tx.insert(teamMember).values({
        teamId: newTeam.id,
        userId: session.user.id,
        role: "owner",
      });

      return { ent, teamId: newTeam.id };
    });

    // 事务提交成功后设置 cookie，触发 JWT 回调刷新 session
    // （accountType / enterpriseId / teamId 在下次请求时从 DB 重新读取）
    try {
      const cookieStore = await cookies();
      cookieStore.set("refresh_session", "1", {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60,
      });
      cookieStore.set("switch_team_id", result.teamId, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60,
      });
    } catch {
      // 静默忽略
    }

    revalidatePath("/");
    return { success: true, data: result.ent };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/**
 * 提交企业资质认证（unverified → pending）。
 */
export async function submitEnterpriseVerificationAction(input: {
  licenseImage: string;
  contactName: string;
  contactPhone: string;
}): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.enterpriseId) {
      return { success: false, error: "无企业账号" };
    }

    await db
      .update(enterprise)
      .set({
        licenseImage: input.licenseImage,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        verifyStatus: "pending",
        updatedAt: new Date(),
      })
      .where(eq(enterprise.id, session.user.enterpriseId));

    revalidatePath("/settings");
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/**
 * 校验当前用户是当前团队的管理员（owner/admin），返回团队 ID。
 * 供团队管理类 Action 复用。
 */
async function requireTeamAdmin(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.teamId) {
    return null;
  }

  const [member] = await db
    .select({ role: teamMember.role })
    .from(teamMember)
    .where(
      and(
        eq(teamMember.teamId, session.user.teamId),
        eq(teamMember.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!member || (member.role !== "owner" && member.role !== "admin")) {
    return null;
  }

  return session.user.teamId;
}

/**
 * 邀请企业成员（把已有个人账号加入企业团队）。
 * 仅企业 owner/admin 可调用。
 *
 * 团队个人账号保持 accountType=personal，登录后功能与注册个人账号一致
 * （有知识库、创作者中心，无团队管理功能），仅通过 enterpriseId 关联企业。
 */
export async function inviteEnterpriseMemberAction(input: {
  email: string;
  role?: "admin" | "member";
}): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.enterpriseId) {
      return { success: false, error: "无企业账号" };
    }

    const teamId = await requireTeamAdmin();
    if (!teamId) {
      return { success: false, error: "无权限或未选择团队" };
    }

    // 查找被邀请用户
    const [target] = await db
      .select()
      .from(user)
      .where(eq(user.email, input.email))
      .limit(1);
    if (!target) {
      return { success: false, error: "用户不存在" };
    }
    if (target.enterpriseId) {
      return { success: false, error: "该用户已属于其他企业" };
    }

    // 团队个人账号保持 accountType=personal（功能与注册个人账号一致），
    // 仅设置 enterpriseId 关联企业，不升级为 enterprise 账号
    await db
      .update(user)
      .set({
        enterpriseId: session.user.enterpriseId,
        updatedAt: new Date(),
      })
      .where(eq(user.id, target.id));

    // 加入企业团队
    await db.insert(teamMember).values({
      teamId,
      userId: target.id,
      role: input.role ?? "member",
    });

    revalidatePath("/team");
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/**
 * 创建团队个人账号（企业管理员在团队功能里创建新账号）。
 * 仅企业 owner/admin 可调用。
 *
 * 创建的新账号 accountType=personal，登录后功能与注册个人账号一致
 * （有知识库、创作者中心，无团队管理功能），自动加入企业团队。
 */
export async function createTeamMemberAccountAction(input: {
  email: string;
  password: string;
  name?: string;
  role?: "admin" | "member";
}): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.enterpriseId) {
      return { success: false, error: "无企业账号" };
    }

    const teamId = await requireTeamAdmin();
    if (!teamId) {
      return { success: false, error: "无权限或未选择团队" };
    }

    // 校验邮箱未被注册
    const [existing] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, input.email))
      .limit(1);
    if (existing) {
      return { success: false, error: "该邮箱已被注册" };
    }

    const hashedPassword = generateHashedPassword(input.password);

    return await db.transaction(async (tx) => {
      // 1. 创建团队个人账号（accountType=personal，功能与注册个人账号一致）
      const [newUser] = await tx
        .insert(user)
        .values({
          email: input.email,
          password: hashedPassword,
          name: input.name ?? null,
          accountType: "personal",
          enterpriseId: session.user.enterpriseId,
        })
        .returning({ id: user.id });

      // 2. 加入企业团队（member 角色）
      await tx.insert(teamMember).values({
        teamId,
        userId: newUser.id,
        role: input.role ?? "member",
      });

      revalidatePath("/team");
      return { success: true };
    });
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/**
 * 获取当前企业信息（含认证状态）。
 */
export async function getEnterpriseDataAction(): Promise<ActionResult<Enterprise | null>> {
  try {
    const session = await auth();
    if (!session?.user?.enterpriseId) {
      return { success: false, error: "无企业账号" };
    }

    const [ent] = await db
      .select()
      .from(enterprise)
      .where(eq(enterprise.id, session.user.enterpriseId))
      .limit(1);

    return { success: true, data: ent ?? null };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/**
 * 移除团队成员（企业管理员将成员移出团队）。
 * 仅企业 owner/admin 可调用；不能移除 owner。
 *
 * 移除后成员的 enterpriseId 清空，accountType 保持 personal（回归普通个人账号）。
 */
export async function removeTeamMemberAction(input: {
  userId: string;
}): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.enterpriseId) {
      return { success: false, error: "无企业账号" };
    }

    // 不能移除自己
    if (input.userId === session.user.id) {
      return { success: false, error: "不能移除自己" };
    }

    const teamId = await requireTeamAdmin();
    if (!teamId) {
      return { success: false, error: "无权限或未选择团队" };
    }

    // 校验目标用户是该团队成员且不是 owner
    const [member] = await db
      .select({ role: teamMember.role })
      .from(teamMember)
      .where(
        and(
          eq(teamMember.teamId, teamId),
          eq(teamMember.userId, input.userId),
        ),
      )
      .limit(1);

    if (!member) {
      return { success: false, error: "该用户不是团队成员" };
    }
    if (member.role === "owner") {
      return { success: false, error: "不能移除团队所有者" };
    }

    return await db.transaction(async (tx) => {
      // 1. 从团队移除
      await tx
        .delete(teamMember)
        .where(
          and(
            eq(teamMember.teamId, teamId),
            eq(teamMember.userId, input.userId),
          ),
        );

      // 2. 清空 enterpriseId（回归普通个人账号，accountType 保持 personal）
      await tx
        .update(user)
        .set({ enterpriseId: null, updatedAt: new Date() })
        .where(eq(user.id, input.userId));

      revalidatePath("/team");
      return { success: true };
    });
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/**
 * 更新团队成员角色（member ↔ admin）。
 * 仅企业 owner/admin 可调用；不能修改 owner 角色。
 */
export async function updateTeamMemberRoleAction(input: {
  userId: string;
  role: "admin" | "member";
}): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.enterpriseId) {
      return { success: false, error: "无企业账号" };
    }

    const teamId = await requireTeamAdmin();
    if (!teamId) {
      return { success: false, error: "无权限或未选择团队" };
    }

    // 校验目标用户是该团队成员且不是 owner
    const [member] = await db
      .select({ role: teamMember.role })
      .from(teamMember)
      .where(
        and(
          eq(teamMember.teamId, teamId),
          eq(teamMember.userId, input.userId),
        ),
      )
      .limit(1);

    if (!member) {
      return { success: false, error: "该用户不是团队成员" };
    }
    if (member.role === "owner") {
      return { success: false, error: "不能修改团队所有者角色" };
    }

    await db
      .update(teamMember)
      .set({ role: input.role })
      .where(
        and(
          eq(teamMember.teamId, teamId),
          eq(teamMember.userId, input.userId),
        ),
      );

    revalidatePath("/team");
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}
