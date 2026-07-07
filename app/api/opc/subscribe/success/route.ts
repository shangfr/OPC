import { NextResponse } from "next/server";
import { isStripeEnabled, stripe } from "@/lib/payments/stripe";
import { activateSubscription } from "@/lib/db/queries";

/**
 * OPC 订阅支付成功回跳。
 * 流程：Stripe checkout 成功 → 回跳本路由 → 用 order_id 激活订阅 → 重定向商城
 *
 * Mock 模式：subscribeOpcAction 已直接激活订阅，这里仅做重定向。
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("order_id");

  if (!orderId) {
    return NextResponse.redirect(new URL("/marketplace", req.url));
  }

  // Mock 模式或已激活：直接跳转
  if (!isStripeEnabled || !stripe) {
    return NextResponse.redirect(new URL("/marketplace?subscribed=1", req.url));
  }

  try {
    // 即时激活订阅（webhook 会做幂等处理）
    await activateSubscription({ orderId });
    return NextResponse.redirect(new URL("/marketplace?subscribed=1", req.url));
  } catch (error) {
    console.error("[opc subscribe] 激活订阅失败:", error);
    return NextResponse.redirect(new URL("/marketplace?error=1", req.url));
  }
}
