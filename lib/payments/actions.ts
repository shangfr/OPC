"use server";

import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db/queries";
import { team, teamMember } from "@/lib/db/schema";
import {
  createCheckoutSession,
  createCustomerPortalSession,
  isStripeEnabled,
  mockUpgradePlan,
  PLANS,
} from "./stripe";

/**
 * 支付相关 Server Actions（从 saas-starter/lib/payments/actions.ts 移植）
 *
 * 适配点：
 * - saas-starter 用 withTeam 中间件从 JWT 拿 team；opcbot 改用 Auth.js session
 *   的 session.user.teamId，并校验当前用户是该团队成员
 *
 * Mock 模式：未配置 Stripe 时，checkoutAction 直接升级套餐，不跳转支付。
 * 个人账号无团队时，Mock 模式下自动创建个人团队用于配额跟踪（不显示团队管理 UI）。
 */

/** 获取当前用户在当前团队下的团队记录（含 Stripe 字段） */
async function getCurrentTeamRecord() {
  const session = await auth();
  if (!session?.user?.id || !session.user.teamId) {
    throw new Error("未登录或未选择团队");
  }

  // 校验成员资格（租户隔离）
  const [member] = await db
    .select()
    .from(teamMember)
    .where(
      and(
        eq(teamMember.teamId, session.user.teamId),
        eq(teamMember.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!member) {
    throw new Error("您不是该团队的成员");
  }

  const [teamRecord] = await db
    .select()
    .from(team)
    .where(eq(team.id, session.user.teamId))
    .limit(1);

  if (!teamRecord) {
    throw new Error("团队不存在");
  }

  return { teamRecord, role: member.role };
}

/**
 * Mock 模式下为个人账号自动创建个人团队（用于配额跟踪）。
 * 个人账号的团队不显示团队管理 UI（由 accountType !== "enterprise" 拦截）。
 */
async function ensurePersonalTeam(userId: string): Promise<string> {
  // 先查是否已有团队
  const [existing] = await db
    .select({ teamId: teamMember.teamId })
    .from(teamMember)
    .where(eq(teamMember.userId, userId))
    .limit(1);

  if (existing) {
    return existing.teamId;
  }

  // 创建个人团队
  const [newTeam] = await db
    .insert(team)
    .values({
      name: "个人空间",
      ownerId: userId,
    })
    .returning({ id: team.id });

  await db.insert(teamMember).values({
    teamId: newTeam.id,
    userId,
    role: "owner",
  });

  return newTeam.id;
}

/**
 * 发起 Stripe Checkout（订阅升级）。
 * Mock 模式下直接升级套餐，不跳转支付。
 * 个人账号无团队时，Mock 模式下自动创建个人团队用于配额跟踪。
 *
 * 权限：个人账号可自由升级；企业账号仅团队管理员（owner/admin）可操作。
 */
export async function checkoutAction(formData: FormData) {
  const priceId = formData.get("priceId") as string;
  if (!priceId) {
    throw new Error("缺少 priceId");
  }

  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("未登录");
  }

  // 企业账号：仅团队管理员可升级套餐
  if (session.user.accountType === "enterprise") {
    const teamRole = session.user.teamRole as string | undefined;
    if (teamRole !== "owner" && teamRole !== "admin") {
      throw new Error("无权限：仅团队管理员可管理订阅套餐");
    }
  }

  // Mock 模式
  if (!isStripeEnabled) {
    const planName = priceId.replace(/^plan_/, "");
    if (!PLANS[planName]) {
      throw new Error(`未知套餐: ${planName}`);
    }

    // 个人账号无团队时，自动创建个人团队用于配额跟踪
    let teamId = session.user.teamId;
    if (!teamId) {
      teamId = await ensurePersonalTeam(session.user.id);
    }

    await mockUpgradePlan({ teamId, planName });
    redirect("/settings?upgraded=1");
  }

  // Stripe 模式：需要团队记录
  const { teamRecord } = await getCurrentTeamRecord();
  const checkoutSession = await createCheckoutSession({
    team: teamRecord,
    priceId,
  });
  redirect(checkoutSession.url!);
}

/**
 * 打开 Stripe Customer Portal（管理账单/取消订阅）。
 * Mock 模式下跳转到设置页。
 *
 * 权限：企业账号仅团队管理员（owner/admin）可操作。
 */
export async function customerPortalAction() {
  if (!isStripeEnabled) {
    redirect("/settings");
  }

  const { teamRecord, role } = await getCurrentTeamRecord();

  // 企业账号：仅团队管理员可管理账单
  const session = await auth();
  if (session?.user?.accountType === "enterprise" && role !== "owner" && role !== "admin") {
    throw new Error("无权限：仅团队管理员可管理账单");
  }

  const portalSession = await createCustomerPortalSession(teamRecord);
  redirect(portalSession.url);
}
