import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { getMarketplaceAgents, getSubscribedOpcs } from "@/lib/db/queries";
import { SubscribeButton } from "./subscribe-button";

/**
 * OPC 交易市场：服务商城页
 *
 * 展示全部已上架公共 OPC（listingStatus=listed）。
 * - 企业管理员：显示「订阅」或「已订阅·取消订阅」按钮
 * - 个人用户：仅浏览市场行情（无订阅按钮）
 * - 普通企业成员：不可访问此页面（重定向至首页）
 *
 * 访问权限：个人用户、企业管理员（accountType=enterprise && teamRole=owner/admin）
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

  const accountType = (session.user.accountType as "personal" | "enterprise") ?? "personal";
  const teamRole = (session.user.teamRole as string) ?? null;
  const isEnterpriseAdmin = accountType === "enterprise" && (teamRole === "owner" || teamRole === "admin");
  // 普通企业成员不可访问交易市场
  if (accountType === "enterprise" && !isEnterpriseAdmin) {
    redirect("/");
  }

  const params = await searchParams;

  const [agents, subscribedOpcs] = await Promise.all([
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
  ]);

  // 仅企业管理员可订阅；个人用户和普通企业成员仅浏览
  const canSubscribe = isEnterpriseAdmin;
  // 已订阅的 agentId 集合
  const subscribedAgentIds = new Set(subscribedOpcs.map((s) => s.agent.id));

  return (
    <main className="page-container mx-auto max-w-6xl pb-tabbar">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">OPC 服务商城</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          浏览全部已上架的公共 OPC 智能体。企业账号可订阅雇佣，将 OPC 接入团队工作流。
        </p>
      </div>

      {/* 搜索 */}
      <form className="mb-6 flex gap-2">
        <input
          type="text"
          name="search"
          placeholder="搜索 OPC 名称或描述..."
          defaultValue={params.search ?? ""}
          className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
        />
        <button
          type="submit"
          className="touch-target rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          搜索
        </button>
      </form>

      {agents.length === 0 ? (
        <div className="empty-state">
          <p className="text-sm text-muted-foreground">暂无已上架的公共 OPC</p>
        </div>
      ) : (
        <div className="card-grid">
          {agents.map((agent) => {
            const isSubscribed = subscribedAgentIds.has(agent.id);
            return (
              <div
                key={agent.id}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="mb-2 flex items-start justify-between">
                  <h3 className="text-base font-semibold text-foreground">
                    {agent.name}
                  </h3>
                  {isSubscribed && (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                      已订阅
                    </span>
                  )}
                </div>
                <p className="mb-4 line-clamp-2 text-xs text-muted-foreground">
                  {agent.description}
                </p>
                <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <div>
                    <span className="text-lg font-bold text-foreground">
                      ¥{(agent.priceMonthly / 100).toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground">/月</span>
                  </div>
                  <div>
                    <span className="text-lg font-bold text-foreground">
                      ¥{(agent.priceYearly / 100).toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground">/年</span>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
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
                    <span className="flex-1 rounded-lg border border-border px-4 py-2 text-center text-xs text-muted-foreground">
                      仅企业账号可订阅
                    </span>
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
