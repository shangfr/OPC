"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * 商城订阅按钮：调用 subscribeOpcAction 发起订阅。
 * - Stripe 已配置：跳转 Stripe Checkout 支付
 * - Mock 模式：直接激活订阅，提示成功
 *
 * 已订阅时显示「已订阅」状态 + 「取消订阅」按钮（destructive variant）。
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
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if (result.data?.checkoutUrl) {
        // Stripe 模式：跳转支付页
        window.location.href = result.data.checkoutUrl;
      } else {
        // Mock 模式：直接激活成功
        toast.success("订阅成功");
        router.refresh();
      }
    } catch {
      toast.error("订阅失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  async function handleCancel() {
    if (!subscriptionId) return;
    setPending(true);
    try {
      const result = await cancelSubscriptionAction(subscriptionId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("已取消订阅");
      router.refresh();
    } catch {
      toast.error("取消订阅失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  // 已订阅状态：显示已订阅标签 + 取消订阅按钮
  if (isSubscribed) {
    return (
      <div className="flex w-full items-center gap-2">
        <div className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-2 text-xs font-medium text-emerald-600">
          <Check className="size-3.5" />
          已订阅
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleCancel}
              disabled={pending}
              variant="destructive"
              size="sm"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : "取消"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>取消订阅此 OPC</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  // 未订阅状态：周期选择 + 订阅按钮
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
