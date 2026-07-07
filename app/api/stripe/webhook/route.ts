import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, isStripeEnabled, handleSubscriptionChange, handleSubscriptionDeleted } from "@/lib/payments/stripe";
import { activateSubscription } from "@/lib/db/queries";

/**
 * Stripe Webhook 处理（从 saas-starter 移植，适配 opcbot + OPC 交易市场）
 *
 * 监听事件：
 * - checkout.session.completed        支付成功
 *   - SaaS 套餐订阅：customerId 落库 team 表（由 subscription 事件同步状态）
 *   - OPC 订阅订单：client_reference_id = orderId → 调用 activateSubscription 激活
 * - customer.subscription.created/updated  SaaS 套餐订阅状态同步
 * - customer.subscription.deleted          SaaS 套餐取消 → 降级 free
 *
 * Mock 模式（未配置 Stripe）：直接返回 200，不处理任何事件。
 */
export async function POST(req: Request) {
  // Mock 模式：不处理 webhook
  if (!isStripeEnabled || !stripe) {
    return NextResponse.json({ received: true, mock: true });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ""
    );
  } catch (error) {
    console.error("[stripe webhook] 签名验证失败:", error);
    return NextResponse.json(
      { error: `Webhook Error: ${(error as Error).message}` },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // OPC 交易市场：单次支付订单（mode=payment），client_reference_id = orderId
        if (session.mode === "payment" && session.client_reference_id) {
          await activateSubscription({
            orderId: session.client_reference_id,
            stripePaymentIntentId:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : session.payment_intent?.id,
          });
        }
        // SaaS 套餐订阅（mode=subscription）：customerId 由 subscription 事件同步
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;
        await handleSubscriptionChange(subscription, customerId);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;
        await handleSubscriptionDeleted(subscription, customerId);
        break;
      }

      default:
        // 忽略未处理的事件类型
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe webhook] 事件处理失败:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
