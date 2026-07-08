import Link from "next/link";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { auth } from "@/app/(auth)/auth";
import { getCurrentTeam } from "@/lib/auth/team-context";
import { getTeamUsage } from "@/lib/quotas/usage";
import { isStripeEnabled } from "@/lib/payments/stripe";
import { checkoutAction } from "@/lib/payments/actions";
import { db } from "@/lib/db/queries";
import { eq } from "drizzle-orm";
import { team } from "@/lib/db/schema";
import { ManageBillingButton } from "./manage-billing-button";
import { SubmitButton } from "../pricing/submit-button";

/**
 * 订阅管理页（合并原 /settings 与 /pricing）。
 *
 * 展示：当前套餐、用量、账单入口、全部套餐方案（升级/降级）。
 * 管理员账号默认享有最高套餐 Plus（无需支付）。
 */
export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // 管理员默认享有 Plus 套餐：若当前团队套餐非 plus，自动升级
  if (session.user.role === "admin" && session.user.teamId) {
    await ensureAdminPlusPlan(session.user.teamId);
  }

  const currentTeam = await getCurrentTeam();
  const usage = currentTeam ? await getTeamUsage(currentTeam.id) : null;

  const usagePercent =
    usage && usage.maxMessages && usage.usedMessages !== null
      ? Math.min(100, (usage.usedMessages / usage.maxMessages) * 100)
      : 0;

  const currentPlanName = currentTeam?.planName ?? "free";
  const isAdmin = session.user.role === "admin";

  // 企业账号：仅团队管理员（owner/admin）可管理订阅
  // 个人账号：可自由升级
  const isEnterpriseMember =
    session.user.accountType === "enterprise" &&
    session.user.teamRole !== "owner" &&
    session.user.teamRole !== "admin";

  // 套餐方案（合并自原 /pricing 页）
  const LOCAL_PLANS = [
    {
      id: "free",
      name: "Free",
      description: "适合个人体验",
      price: 0,
      features: ["每月 100 条消息", "最多 3 名成员", "基础 OPC 库访问"],
    },
    {
      id: "base",
      name: "Base",
      description: "适合小型团队",
      price: 99,
      features: ["每月 2000 条消息", "最多 10 名成员", "全部 OPC 库访问", "团队管理功能"],
    },
    {
      id: "plus",
      name: "Plus",
      description: "适合大型企业",
      price: 299,
      features: ["无限消息", "无限成员", "全部 OPC 库访问", "优先技术支持", "API 接入"],
    },
  ];

  // priceId 格式：Mock 模式用 plan_<id>，Stripe 模式由后端解析
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

          <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-6 sm:gap-6 md:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlanName;
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-xl border p-4 sm:p-6 ${
                    plan.id === "base"
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background"
                  }`}
                >
                  {plan.id === "base" && (
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
                        管理员已享 Plus
                      </span>
                    ) : isEnterpriseMember ? (
                      <span className="block w-full rounded-lg border border-border bg-background px-4 py-2 text-center text-xs font-medium text-muted-foreground">
                        联系管理员升级
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
            <li>· Free：每月 100 条消息，最多 3 名成员</li>
            <li>· Base：每月 2000 条消息，最多 10 名成员</li>
            <li>· Plus：无限消息，无限成员</li>
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            配额按订阅周期重置。升级套餐后立即生效并重置已用消息数。
          </p>
        </section>
      </div>
    </main>
  );
}

/**
 * 确保管理员团队享有 Plus 套餐。
 * 若当前团队套餐非 plus，则自动升级（Mock 模式直接更新数据库）。
 */
async function ensureAdminPlusPlan(teamId: string) {
  try {
    const [teamRecord] = await db
      .select({ planName: team.planName })
      .from(team)
      .where(eq(team.id, teamId))
      .limit(1);

    if (teamRecord && teamRecord.planName !== "plus") {
      await db
        .update(team)
        .set({
          planName: "plus",
          subscriptionStatus: "active",
          updatedAt: new Date(),
        })
        .where(eq(team.id, teamId));
    }
  } catch {
    // 静默失败，不影响页面渲染
  }
}
