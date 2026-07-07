import { NextResponse } from "next/server";
import { isStripeEnabled, stripe } from "@/lib/payments/stripe";

/**
 * Stripe Checkout 回跳处理（从 saas-starter 移植）
 *
 * 流程：用户在 Stripe 完成支付 → 回跳到 /api/stripe/checkout?session_id=xxx
 * → 服务端用 session_id 取 checkout session → 把 customerId 写回 team 表
 * → 重定向到 /settings（订阅管理页）
 *
 * Mock 模式：直接重定向到 /settings。
 */
export async function GET(req: Request) {
  // Mock 模式：直接跳转设置页
  if (!isStripeEnabled || !stripe) {
    return NextResponse.redirect(new URL("/settings", req.url));
  }

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.redirect(new URL("/settings", req.url));
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.client_reference_id && session.customer) {
      const { db } = await import("@/lib/db/queries");
      const { team } = await import("@/lib/db/schema");
      const { eq } = await import("drizzle-orm");

      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer.id;

      await db
        .update(team)
        .set({
          stripeCustomerId: customerId,
          updatedAt: new Date(),
        })
        .where(eq(team.id, session.client_reference_id));
    }

    return NextResponse.redirect(new URL("/settings", req.url));
  } catch (error) {
    console.error("[stripe checkout] 回调处理失败:", error);
    return NextResponse.redirect(new URL("/settings", req.url));
  }
}
