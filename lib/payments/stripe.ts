import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/queries";
import { team, type Team } from "@/lib/db/schema";
import { isStripeEnabled, PLANS, getPlanQuota, type PlanQuota } from "./config";

// re-export 供 server-side 代码统一从 stripe.ts 导入
export { isStripeEnabled, PLANS, getPlanQuota, type PlanQuota };

/**
 * Stripe 支付封装（从 saas-starter/lib/payments/stripe.ts 移植，适配 opcbot）
 *
 * 适配点：
 * - saas-starter 用 teams 表(serial id) + snake_case 列名；opcbot 用 team 表(uuid) + camelCase
 * - saas-starter 的 planName 取自 Stripe 产品名；opcbot 额外维护 maxMessages/maxMembers 配额字段
 * - 认证：saas-starter 用 withTeam 中间件；opcbot 用 Auth.js session（见 actions.ts）
 *
 * 国内业务替换说明：若不做 Stripe 而用支付宝/微信支付，只需替换本文件的
 * createCheckoutSession / createCustomerPortalSession / webhook 事件处理，
 * 上层 actions.ts 与 pricing 页面无需改动。
 *
 * ============================================================
 * Mock 模式：未配置 STRIPE_SECRET_KEY 时自动降级为模拟支付
 * - checkoutAction 直接升级套餐（不跳转 Stripe）
 * - customerPortalAction 不执行实际操作
 * - OPC 订阅直接激活（无需支付）
 * ============================================================
 */

if (!isStripeEnabled) {
  console.warn("[payments] STRIPE_SECRET_KEY 未配置，支付功能使用 Mock 模式");
}

export const stripe = isStripeEnabled
  ? new Stripe(process.env.STRIPE_SECRET_KEY as string, {
      apiVersion: "2024-06-20",
      typescript: true,
    })
  : null;

// ============================================================
// 价格 / 产品查询（供定价页展示）
// ============================================================
export async function getStripePrices() {
  if (!isStripeEnabled || !stripe) return [];
  return stripe.prices.list({
    expand: ["data.product"],
  });
}

export async function getStripeProducts() {
  if (!isStripeEnabled || !stripe) return [];
  return stripe.products.list();
}

/**
 * Mock 模式下直接升级团队套餐（不经过 Stripe）。
 * 实际项目中替换为支付宝/微信支付时，此函数改为对应支付渠道的跳转逻辑。
 */
export async function mockUpgradePlan({
  teamId,
  planName,
}: {
  teamId: string;
  planName: string;
}) {
  const quota = getPlanQuota(planName);
  await db
    .update(team)
    .set({
      planName,
      maxMessages: quota.maxMessages,
      maxMembers: quota.maxMembers,
      subscriptionStatus: "active",
      usedMessages: 0,
      usageResetAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(team.id, teamId));
}

// ============================================================
// Checkout / Customer Portal
// ============================================================

/**
 * 创建 Stripe Checkout Session。
 * teamId 作为 client_reference_id，checkout 回跳时用它定位团队。
 */
export async function createCheckoutSession({
  team: teamRecord,
  priceId,
}: {
  team: Team;
  priceId: string;
}) {
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  return stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer: teamRecord.stripeCustomerId ?? undefined,
    customer_email: teamRecord.stripeCustomerId
      ? undefined
      : undefined, // 由前端传用户邮箱更佳，这里留空
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    client_reference_id: teamRecord.id,
    success_url: `${appUrl}/api/stripe/checkout?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/settings`,
    subscription_data: {
      trial_period_days: 7, // 7 天试用
    },
  });
}

/**
 * 创建 Stripe Customer Portal Session（用户管理订阅/账单）。
 */
export async function createCustomerPortalSession(teamRecord: Team) {
  if (!teamRecord.stripeCustomerId) {
    throw new Error("该团队尚未绑定 Stripe 客户，无法打开账单管理");
  }

  const appUrl = process.env.APP_URL || "http://localhost:3000";

  return stripe.billingPortal.sessions.create({
    customer: teamRecord.stripeCustomerId,
    return_url: `${appUrl}/settings`,
  });
}

// ============================================================
// Webhook 事件处理：同步订阅状态到 team 表
// ============================================================

/**
 * 处理订阅变更（创建/更新/删除），把 Stripe 状态同步到 team 表。
 * 同时根据套餐名更新 maxMessages / maxMembers 配额字段。
 */
export async function handleSubscriptionChange(
  subscription: Stripe.Subscription,
  customerId: string
) {
  // 通过 stripeCustomerId 反查团队
  const [teamRecord] = await db
    .select()
    .from(team)
    .where(eq(team.stripeCustomerId, customerId))
    .limit(1);

  if (!teamRecord) {
    console.warn(`[stripe] 未找到 customerId=${customerId} 对应的团队`);
    return;
  }

  const plan = subscription.items.data[0]?.price;
  if (!plan) {
    console.warn("[stripe] 订阅无价格项");
    return;
  }

  const productId =
    typeof plan.product === "string" ? plan.product : plan.product?.id;

  // 取产品名作为 planName（小写化以匹配 PLANS 键）
  let planName = teamRecord.planName ?? "free";
  if (productId) {
    try {
      const product = await stripe.products.retrieve(productId);
      planName = (product.name || "free").toLowerCase();
    } catch {
      // 取产品失败则保留原 planName
    }
  }

  const quota = getPlanQuota(planName);

  await db
    .update(team)
    .set({
      stripeSubscriptionId: subscription.id,
      stripeProductId: productId ?? null,
      planName,
      subscriptionStatus: subscription.status,
      subscriptionStart: subscription.current_period_start
        ? new Date(subscription.current_period_start * 1000)
        : null,
      subscriptionEnd: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000)
        : null,
      // 同步配额（升级/降级套餐时立即生效）
      maxMessages: quota.maxMessages,
      maxMembers: quota.maxMembers,
      // 套餐变更时重置已用消息数
      usedMessages: 0,
      usageResetAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(team.id, teamRecord.id));
}

/**
 * 处理订阅删除（用户取消订阅），降级为 free 套餐。
 */
export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  customerId: string
) {
  const [teamRecord] = await db
    .select()
    .from(team)
    .where(eq(team.stripeCustomerId, customerId))
    .limit(1);

  if (!teamRecord) return;

  const quota = getPlanQuota("free");

  await db
    .update(team)
    .set({
      stripeSubscriptionId: null,
      stripeProductId: null,
      planName: "free",
      subscriptionStatus: "canceled",
      maxMessages: quota.maxMessages,
      maxMembers: quota.maxMembers,
      usedMessages: 0,
      usageResetAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(team.id, teamRecord.id));
}
