"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/app/(auth)/auth";
import { createOpcOrder, activateSubscription, cancelSubscription } from "@/lib/db/queries";
import { isStripeEnabled, stripe } from "@/lib/payments/stripe";
import type { ActionResult } from "@/lib/enterprise/actions";

/**
 * OPC 交易市场：订阅雇佣 Server Action
 *
 * 流程：
 * 1. 校验当前用户是企业管理员（accountType=enterprise && teamRole=owner/admin）
 * 2. 创建订单（pending 状态）
 * 3. Stripe 已配置：创建 Checkout Session → 跳转支付
 *    Mock 模式：直接激活订阅（无需支付）
 * 4. 支付成功 → activateSubscription 激活订阅 + 写入收益记录
 *
 * 权限：仅企业管理员可订阅（代表企业订阅 OPC 服务）
 * 普通企业成员（teamRole=member）和个人用户无权订阅。
 */

export async function subscribeOpcAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "未登录" };
    }

    const accountType = (session.user.accountType as "personal" | "enterprise") ?? "personal";
    const teamRole = (session.user.teamRole as string) ?? null;
    const isEnterpriseAdmin = accountType === "enterprise" && (teamRole === "owner" || teamRole === "admin");

    // 仅企业管理员可订阅；普通企业成员和个人用户不可
    if (!isEnterpriseAdmin || !session.user.enterpriseId) {
      return { success: false, error: "仅企业管理员可订阅" };
    }

    const agentId = formData.get("agentId") as string;
    const period = (formData.get("period") as "monthly" | "yearly") || "monthly";

    if (!agentId) {
      return { success: false, error: "缺少参数 agentId" };
    }

    // 创建订单（pending 状态）
    const { order, agent: agentRow } = await createOpcOrder({
      enterpriseId: session.user.enterpriseId,
      userId: session.user.id,
      agentId,
      period,
    });

    // Mock 模式：直接激活订阅
    if (!isStripeEnabled) {
      await activateSubscription({ orderId: order.id });
      return {
        success: true,
        data: { orderId: order.id, mock: true },
      };
    }

    // Stripe 模式：创建 Checkout Session 并跳转支付
    const checkoutSession = await stripe!.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      client_reference_id: order.id,
      line_items: [
        {
          price_data: {
            currency: "cny",
            product_data: {
              name: `${agentRow.name} - ${period === "monthly" ? "月度" : "年度"}订阅`,
              description: agentRow.description || undefined,
            },
            unit_amount: Number(order.amount),
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.APP_URL || "http://localhost:3000"}/api/opc/subscribe/success?order_id=${order.id}`,
      cancel_url: `${process.env.APP_URL || "http://localhost:3000"}/marketplace?canceled=1`,
      metadata: {
        orderId: order.id,
        agentId,
        enterpriseId: session.user.enterpriseId,
        period,
      },
    });

    // 返回跳转 URL，由客户端跳转
    return {
      success: true,
      data: { checkoutUrl: checkoutSession.url },
    };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/**
 * 取消订阅（企业管理员调用）。
 */
export async function cancelSubscriptionAction(
  subscriptionId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "未登录" };
    }

    await cancelSubscription({
      subscriptionId,
      userId: session.user.id,
    });

    revalidatePath("/admin/opcs");
    revalidatePath("/marketplace");
    return { success: true };
  } catch (e) {
    const err = e as { message?: string; cause?: string };
    return { success: false, error: err.cause || err.message || "取消订阅失败" };
  }
}
