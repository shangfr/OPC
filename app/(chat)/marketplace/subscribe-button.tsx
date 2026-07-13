"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { subscribeOpcAction, cancelSubscriptionAction } from "@/lib/opc-market/subscribe-action";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
      <Button
        onClick={handleCancel}
        disabled={pending}
        variant="outline"
        className="flex-1"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        取消订阅
      </Button>
    );
  }

  return (
    <div className="flex w-full items-center gap-2">
      <Select
        value={period}
        onValueChange={(v) => setPeriod(v as "monthly" | "yearly")}
        disabled={pending}
      >
        <SelectTrigger className="w-[80px] text-xs" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="monthly">月度</SelectItem>
          <SelectItem value="yearly">年度</SelectItem>
        </SelectContent>
      </Select>
      <Button
        onClick={handleSubscribe}
        disabled={pending}
        className="flex-1"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        订阅雇佣
      </Button>
    </div>
  );
}
