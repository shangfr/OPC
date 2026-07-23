import Link from "next/link";
import { redirect } from "next/navigation";
import { ShoppingCart, Eye, Search, Sparkles } from "lucide-react";
import { auth } from "@/app/(auth)/auth";
import { getCategories, getMarketplaceAgents, getSubscribedOpcs } from "@/lib/db/queries";
import { hasPlanTier, getPlanQuota } from "@/lib/payments/config";
import { SubscribeButton } from "./subscribe-button";

/**
 * OPC 交易市场：服务商城页
 *
 * 套餐驱动型权限：
 * - Team / Enterprise 套餐用户：可订阅 OPC
 * - Free / Creator 套餐用户：仅浏览市场行情
 * - 平台管理员：可浏览
 */
export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; categoryId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userPlan = session.user.planName ?? "free";
  const isAdmin = session.user.role === "admin";
  // Team 及以上套餐可订阅 OPC
  const canSubscribe = hasPlanTier(userPlan, "team") || isAdmin;

  const params = await searchParams;

  const [agents, subscribedOpcs, categories] = await Promise.all([
    getMarketplaceAgents({
      categoryId: params.categoryId ?? null,
      search: params.search ?? null,
    }),
    session?.user?.enterpriseId
      ? getSubscribedOpcs({
          enterpriseId: session.user.enterpriseId,
          currentUserId: session.user.id,
        })
      : [],
    getCategories(),
  ]);

  // 已订阅的 agentId 集合
  const subscribedAgentIds = new Set(subscribedOpcs.map((s) => s.agent.id));

  return (
    <main className="page-container mx-auto max-w-6xl pb-tabbar">

      {/* 角色权限提示横幅：按套餐显示差异化操作权限说明 */}
      {canSubscribe ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-primary/[0.02] p-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/15">
            <ShoppingCart className="size-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              订阅权限已开启
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              您可以订阅 OPC 服务，订阅后将自动接入团队工作流。当前已订阅 {subscribedOpcs.length} 个 OPC。
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.06] to-amber-500/[0.02] p-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 ring-1 ring-amber-500/15">
            <Eye className="size-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              浏览模式
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              当前套餐（{getPlanQuota(userPlan).label}）不支持订阅 OPC 服务。请升级至 Team 套餐解锁订阅功能。
            </p>
            <Link
              href="/settings"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <Sparkles className="size-3" />
              升级套餐
            </Link>
          </div>
        </div>
      )}

      {/* 分类筛选 */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={`/marketplace${params.search ? `?search=${encodeURIComponent(params.search)}` : ""}`}
          className={`touch-target rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
            !params.categoryId
              ? "border-primary bg-primary text-primary-foreground shadow-sm"
              : "border-border bg-background text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground"
          }`}
        >
          全部
        </Link>
        {categories.map((cat) => {
          const active = params.categoryId === cat.id;
          const href = active
            ? `/marketplace${params.search ? `?search=${encodeURIComponent(params.search)}` : ""}`
            : `/marketplace?categoryId=${cat.id}${params.search ? `&search=${encodeURIComponent(params.search)}` : ""}`;
          return (
            <Link
              key={cat.id}
              href={href}
              className={`touch-target rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-background text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground"
              }`}
            >
              {cat.name}
            </Link>
          );
        })}
      </div>

      {/* 搜索 */}
      <form className="mb-6 flex gap-2">
        {params.categoryId && (
          <input type="hidden" name="categoryId" value={params.categoryId} />
        )}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            name="search"
            placeholder="搜索 OPC 名称或描述..."
            defaultValue={params.search ?? ""}
            className="h-10 w-full rounded-lg border border-border bg-background pl-10 pr-4 text-sm text-foreground shadow-sm transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground hover:border-border/80 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/20 focus:bg-background"
          />
        </div>
        <button
          type="submit"
          className="touch-target rounded-lg bg-gradient-to-br from-primary to-primary/85 px-5 py-2 text-sm font-medium text-primary-foreground shadow-md transition-all hover:from-primary/95 hover:to-primary/80 hover:shadow-lg active:shadow-sm"
        >
          搜索
        </button>
      </form>

      {agents.length === 0 ? (
        <div className="empty-state flex flex-col items-center py-16">
          <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-orange-500/10">
            <ShoppingCart className="size-8 text-orange-500" />
          </div>
          <p className="text-sm font-medium text-foreground/80">
            {params.search || params.categoryId
              ? "未找到匹配的 OPC"
              : "暂无已上架的公共 OPC"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {params.search || params.categoryId
              ? "试试调整搜索条件或切换分类"
              : "敬请期待更多优质 OPC 上架"}
          </p>
        </div>
      ) : (
        <div className="card-grid">
          {agents.map((agent) => {
            const isSubscribed = subscribedAgentIds.has(agent.id);
            return (
              <div
                key={agent.id}
                className="group relative flex flex-col rounded-2xl border border-border/50 bg-gradient-to-br from-card to-muted/20 p-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:from-card hover:to-primary/5 hover:shadow-[var(--shadow-float)]"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-base font-bold text-primary ring-1 ring-primary/10 transition-transform duration-300 group-hover:scale-110">
                    {agent.name.charAt(0) || "A"}
                  </div>
                  {isSubscribed && (
                    <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 ring-1 ring-emerald-500/15 dark:text-emerald-400">
                      已订阅
                    </span>
                  )}
                </div>
                <h3 className="mb-1 text-base font-semibold text-foreground">
                  {agent.name}
                </h3>
                <p className="mb-4 line-clamp-2 text-xs text-muted-foreground">
                  {agent.description}
                </p>
                <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg bg-muted/30 px-3 py-2.5">
                  <div>
                    <span className="text-lg font-bold text-primary">
                      ¥{(agent.priceMonthly / 100).toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground">/月</span>
                  </div>
                  <div className="ml-auto">
                    <span className="text-sm font-semibold text-foreground/80">
                      ¥{(agent.priceYearly / 100).toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground">/年</span>
                  </div>
                </div>

                <div className="mt-auto flex gap-2">
                  {canSubscribe ? (
                    isSubscribed ? (
                      <SubscribeButton
                        agentId={agent.id}
                        subscriptionId={
                          subscribedOpcs.find((s) => s.agent.id === agent.id)
                            ?.subscription.id
                        }
                        isSubscribed
                      />
                    ) : (
                      <SubscribeButton agentId={agent.id} />
                    )
                  ) : (
                    <Link
                      href="/settings"
                      className="flex-1 rounded-lg border border-primary/20 bg-primary/[0.06] px-4 py-2 text-center text-xs font-medium text-primary transition-colors hover:bg-primary/[0.1]"
                    >
                      升级后可订阅
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
