"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { customerPortalAction } from "@/lib/payments/actions";
import { isStripeEnabled } from "@/lib/payments/config";
import { toast } from "@/components/chat/toast";

/**
 * 管理账单按钮：调用 Stripe Customer Portal Server Action。
 * - Stripe 已配置：显示按钮，跳转 Customer Portal
 * - Mock 模式：不渲染（无 Stripe 账单可管理）
 */
export function ManageBillingButton({ teamId }: { teamId: string | null }) {
  const [pending, setPending] = useState(false);

  // Mock 模式下不渲染
  if (!isStripeEnabled || !teamId) return null;

  async function handleClick() {
    setPending(true);
    try {
      await customerPortalAction();
    } catch (e) {
      // redirect() 会抛出错误，这是正常的；只有真正的异常才提示
      if (!(e instanceof Error && e.message.includes("NEXT_REDIRECT"))) {
        toast({ type: "error", description: "无法打开账单管理，请稍后重试" });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <CreditCard className="size-4" />
      )}
      管理账单
    </button>
  );
}
