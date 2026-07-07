/**
 * 支付配置常量（无 DB 依赖，安全用于 Client Component）
 *
 * 从此文件导入 isStripeEnabled / PLANS 等纯常量，
 * 避免从 stripe.ts 导入时连带拉入 server-only 的 db 模块。
 */

export const isStripeEnabled = Boolean(process.env.STRIPE_SECRET_KEY);

export type PlanQuota = {
  name: string;
  maxMessages: number | null;
  maxMembers: number | null;
};

export const PLANS: Record<string, PlanQuota> = {
  free: { name: "free", maxMessages: 100, maxMembers: 3 },
  base: { name: "base", maxMessages: 2000, maxMembers: 10 },
  plus: { name: "plus", maxMessages: null, maxMembers: null },
};

export function getPlanQuota(planName: string | null | undefined): PlanQuota {
  if (planName && PLANS[planName]) {
    return PLANS[planName];
  }
  return PLANS.free;
}
