import { redirect } from "next/navigation";
import { Check, AlertTriangle, Sparkles, Building2 } from "lucide-react";
import { auth } from "@/app/(auth)/auth";
import type { Session } from "next-auth";
import { getCurrentTeam } from "@/lib/auth/team-context";
import { getTeamUsage } from "@/lib/quotas/usage";
import { isStripeEnabled } from "@/lib/payments/stripe";
import { checkoutAction } from "@/lib/payments/actions";
import { PLANS, hasPlanTier } from "@/lib/payments/config";
import { ManageBillingButton } from "./manage-billing-button";
import { SubmitButton } from "../pricing/submit-button";

/**
 * 订阅管理页（套餐驱动型权限体系）。
 *
 * 4 档套餐：Free / Creator / Team / Enterprise
 * 用户直接升级套餐获得对应功能权限，无需区分账号类型。
 */
export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const currentTeam = await getCurrentTeam();
  return renderSettings(session, currentTeam);
}

async function renderSettings(
  session: Session,
  currentTeam: Awaited<ReturnType<typeof getCurrentTeam>>,
) {
  const usage = currentTeam ? await getTeamUsage(currentTeam.id) : null;

  const usagePercent =
    usage && usage.maxMessages && usage.usedMessages !== null
      ? Math.min(100, (usage.usedMessages / usage.maxMessages) * 100)
      : 0;

  // 用户套餐：优先从 session 读取，兜底 free
  const currentPlanName = session.user.planName ?? "free";
  const isAdmin = session.user.role === "admin";

  // 用量预警
  const isUsageWarning = usagePercent >= 80 && usagePercent < 100;
  const isUsageExceeded = usagePercent >= 100;

  // 4 档套餐方案
  const LOCAL_PLANS = [
    {
      id: "free",
      name: "Free",
      description: "适合个人体验",
      price: 0,
      features: ["每月 100 条消息", "创建 1 个 OPC", "基础 OPC 库访问"],
    },
    {
      id: "creator",
      name: "Creator",
      description: "适合独立创作者",
      price: 29,
      features: ["每月 2000 条消息", "创建 10 个 OPC", "收益分成 70%", "全部 OPC 库访问"],
    },
    {
      id: "team",
      name: "Team",
      description: "适合小型团队",
      price: 99,
      features: ["每月 10000 条消息", "创建 20 个 OPC", "团队管理（10 人）", "订阅 OPC 服务", "收益分成 80%"],
    },
    {
      id: "enterprise",
      name: "Enterprise",
      description: "适合大型企业",
      price: 299,
      features: ["无限消息", "创建无限 OPC", "团队管理（无限）", "订阅 OPC 服务", "收益分成 80%", "优先技术支持"],
    },
  ];

  const plans = LOCAL_PLANS.map((p) => ({
    ...p,
    priceId: `plan_${p.id}`,
  }));

  return (
    <main className="page-container mx-auto max-w-5xl pb-tabbar">
      <h1 className="text-xl font-semibold text-foreground sm:text-2xl">订阅管理</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        查看你的套餐、用量、账单，并选择适合的套餐方案。
      </p>

      {/* 套餐信息横幅 */}
      <div
        className={`mt-4 flex items-start gap-3 rounded-lg border p-4 ${
          hasPlanTier(currentPlanName, "team")
            ? "border-blue-500/20 bg-blue-500/[0.04]"
            : "border-emerald-500/20 bg-emerald-500/[0.04]"
        }`}
      >
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
            hasPlanTier(currentPlanName, "team") ? "bg-blue-500/10" : "bg-emerald-500/10"
          }`}
        >
          {hasPlanTier(currentPlanName, "team") ? (
            <Building2 className="size-4 text-blue-600 dark:text-blue-400" />
          ) : (
            <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            当前套餐：{PLANS[currentPlanName]?.label ?? "Free"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isAdmin
              ? "平台管理员身份，可管理全部用户与 OPC。套餐功能需自行订阅。"
              : hasPlanTier(currentPlanName, "team")
                ? "已解锁团队管理、OPC 订阅与收益分成功能。"
                : "升级套餐可解锁更多功能：OPC 创建、收益分成、团队管理等。"}
          </p>
        </div>
      </div>

      {/* 用量预警横幅：用量达 80% 或超额时提示 */}
      {(isUsageWarning || isUsageExceeded) && (
        <div
          className={`mt-3 flex items-start gap-3 rounded-lg border p-3 ${
            isUsageExceeded
              ? "border-red-500/30 bg-red-500/[0.06]"
              : "border-amber-500/30 bg-amber-500/[0.06]"
          }`}
        >
          <AlertTriangle
            className={`size-4 shrink-0 ${
              isUsageExceeded
                ? "text-red-600 dark:text-red-400"
                : "text-amber-600 dark:text-amber-400"
            }`}
          />
          <p className="text-xs text-muted-foreground">
            {isUsageExceeded
              ? "本月消息用量已达上限，新消息将被拒绝。请升级套餐或等待下个计费周期重置。"
              : `本月消息用量已使用 ${usagePercent.toFixed(0)}%，接近配额上限。建议提前升级套餐以避免服务中断。`}
          </p>
        </div>
      )}

      <div className="mt-6 space-y-6 sm:mt-8">
        {/* 当前套餐 */}
        <section className="rounded-lg border border-border bg-card p-4 sm:p-6">
          <h2 className="text-base font-medium text-foreground sm:text-lg">当前套餐</h2>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold capitalize text-foreground">
              {currentPlanName}
            </span>
            {usage?.subscriptionStatus && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {usage.subscriptionStatus}
              </span>
            )}
            {isAdmin && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                管理员特权
              </span>
            )}
          </div>

          {/* 用量 */}
          <div className="mt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">本月消息用量</span>
              <span className="font-medium text-foreground">
                {usage?.usedMessages ?? 0}
                {usage?.maxMessages ? ` / ${usage.maxMessages}` : " / 无限"}
              </span>
            </div>
            {usage?.maxMessages ? (
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
            ) : null}
            {usage?.subscriptionEnd && (
              <p className="mt-3 text-xs text-muted-foreground">
                下次续费：{new Date(usage.subscriptionEnd).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="mt-6 flex flex-wrap gap-3">
            {/* Stripe Customer Portal（仅已绑定 Stripe 客户的团队显示） */}
            <ManageBillingButton teamId={currentTeam?.id ?? null} />
          </div>
        </section>

        {/* 套餐方案（合并自原 /pricing） */}
        <section className="rounded-lg border border-border bg-card p-4 sm:p-6">
          <h2 className="text-base font-medium text-foreground sm:text-lg">套餐方案</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {isStripeEnabled
              ? "随时升级或降级，按月计费"
              : "当前为模拟模式，升级即时生效（无需支付）"}
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-6 sm:gap-6 md:grid-cols-4">
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlanName;
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-xl border p-4 sm:p-6 ${
                    plan.id === "team"
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background"
                  }`}
                >
                  {plan.id === "team" && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                      推荐
                    </span>
                  )}
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      {plan.name}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {plan.description}
                    </p>
                  </div>
                  <div className="mt-4">
                    <span className="text-3xl font-bold text-foreground">
                      ¥{plan.price}
                    </span>
                    <span className="text-xs text-muted-foreground">/月</span>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <Check className="size-3.5 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6">
                    {isCurrent ? (
                      <span className="block w-full rounded-lg border border-border bg-background px-4 py-2 text-center text-xs font-medium text-muted-foreground">
                        当前套餐
                      </span>
                    ) : isAdmin ? (
                      <span className="block w-full rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-center text-xs font-medium text-amber-600 dark:text-amber-400">
                        管理员身份
                      </span>
                    ) : (
                      <form action={checkoutAction}>
                        <input type="hidden" name="priceId" value={plan.priceId} />
                        <SubmitButton />
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {!isStripeEnabled && (
            <p className="mt-6 text-center text-xs text-muted-foreground">
              支付功能正在接入中，当前升级为模拟操作，不会产生实际费用。
            </p>
          )}
        </section>

        {/* 配额说明 */}
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-medium text-foreground">套餐配额说明</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>· Free：每月 100 条消息，创建 1 个 OPC，无团队功能</li>
            <li>· Creator：每月 2000 条消息，创建 10 个 OPC，收益分成 70%</li>
            <li>· Team：每月 10000 条消息，创建 20 个 OPC，团队 10 人，可订阅 OPC，收益 80%</li>
            <li>· Enterprise：无限消息，无限 OPC，无限成员，优先支持</li>
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            配额按订阅周期重置。升级套餐后立即生效并重置已用消息数。
          </p>
        </section>
      </div>
    </main>
  );
}
