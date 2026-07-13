/**
 * 支付配置常量（无 DB 依赖，安全用于 Client Component）
 *
 * 从此文件导入 isStripeEnabled / PLANS 等纯常量，
 * 避免从 stripe.ts 导入时连带拉入 server-only 的 db 模块。
 *
 * ── 套餐驱动型权限体系 ──
 * 4 档套餐决定所有功能权限，不再依赖 accountType 维度。
 * 套餐层级: free < creator < team < enterprise
 */

export const isStripeEnabled = Boolean(process.env.STRIPE_SECRET_KEY);

export type PlanQuota = {
  name: string;
  label: string;
  price: number;
  maxMessages: number | null;
  maxMembers: number | null;
  maxOpcCreate: number | null;
  canSubscribeOpc: boolean;
  canCreateTeam: boolean;
  canRevenueShare: boolean;
  revenuePercent: number;
};

export const PLANS: Record<string, PlanQuota> = {
  free: {
    name: "free",
    label: "Free",
    price: 0,
    maxMessages: 100,
    maxMembers: 1,
    maxOpcCreate: 1,
    canSubscribeOpc: false,
    canCreateTeam: false,
    canRevenueShare: false,
    revenuePercent: 0,
  },
  creator: {
    name: "creator",
    label: "Creator",
    price: 29,
    maxMessages: 2000,
    maxMembers: 1,
    maxOpcCreate: 10,
    canSubscribeOpc: false,
    canCreateTeam: false,
    canRevenueShare: true,
    revenuePercent: 70,
  },
  team: {
    name: "team",
    label: "Team",
    price: 99,
    maxMessages: 10000,
    maxMembers: 10,
    maxOpcCreate: 20,
    canSubscribeOpc: true,
    canCreateTeam: true,
    canRevenueShare: true,
    revenuePercent: 80,
  },
  enterprise: {
    name: "enterprise",
    label: "Enterprise",
    price: 299,
    maxMessages: null,
    maxMembers: null,
    maxOpcCreate: null,
    canSubscribeOpc: true,
    canCreateTeam: true,
    canRevenueShare: true,
    revenuePercent: 80,
  },
};

/** 套餐层级排序，用于权限比较 */
export const PLAN_TIER: Record<string, number> = {
  free: 0,
  creator: 1,
  team: 2,
  enterprise: 3,
};

/** 判断用户套餐是否达到指定级别 */
export function hasPlanTier(userPlan: string | null | undefined, requiredPlan: string): boolean {
  const userTier = PLAN_TIER[userPlan ?? "free"] ?? 0;
  const requiredTier = PLAN_TIER[requiredPlan] ?? 0;
  return userTier >= requiredTier;
}

export function getPlanQuota(planName: string | null | undefined): PlanQuota {
  if (planName && PLANS[planName]) {
    return PLANS[planName];
  }
  return PLANS.free;
}
