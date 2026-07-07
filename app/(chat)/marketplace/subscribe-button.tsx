"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { subscribeOpcAction, cancelSubscriptionAction } from "@/lib/opc-market/subscribe-action";
import { toast } from "sonner";

/**
 * 商城订阅按钮：调用 subscribeOpcAction 发起订阅。
 * - Stripe 已配置：跳转 Stripe Checkout 支付
 * - Mock 模式：直接激活订阅，提示成功
 *
 * 已订阅时显示「取消订阅」按钮，调用 cancelSubscriptionAction。
 */
export function SubscribeButton({
  agentId,
  subscriptionId,
  isSubscribed = false,
}: {
  agentId: string;
  subscriptionId?: string;
  isSubscribed?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const router = useRouter();

  async function handleSubscribe() {
    setPending(true);
    try {
      const formData = new FormData();
      formData.set("agentId", agentId);
      formData.set("period", period);
      const result = await subscribeOpcAction(formData);

      if (result.success) {
        if (result.data?.checkoutUrl) {
          window.location.href = result.data.checkoutUrl;
        } else {
          // Mock 模式，直接激活
          toast.success("订阅成功");
          router.refresh();
        }
      } else {
        toast.error(result.error || "订阅失败");
      }
    } catch {
      toast.error("操作失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  async function handleCancel() {
    if (!subscriptionId) return;
    setPending(true);
    try {
      const result = await cancelSubscriptionAction(subscriptionId);
      if (result.success) {
        toast.success("已取消订阅");
        router.refresh();
      } else {
        toast.error(result.error || "取消订阅失败");
      }
    } catch {
      toast.error("操作失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  if (isSubscribed) {
    return (
      <button
        onClick={handleCancel}
        disabled={pending}
        className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        取消订阅
      </button>
    );
  }

  return (
    <div className="flex w-full items-center gap-2">
      <select
        value={period}
        onChange={(e) => setPeriod(e.target.value as "monthly" | "yearly")}
        disabled={pending}
        className="rounded-lg border border-border bg-background px-2 py-2 text-xs text-foreground"
      >
        <option value="monthly">月度</option>
        <option value="yearly">年度</option>
      </select>
      <button
        onClick={handleSubscribe}
        disabled={pending}
        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        订阅雇佣
      </button>
    </div>
  );
}
