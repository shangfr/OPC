import Link from "next/link";
import { auth } from "@/app/(auth)/auth";
import { getMarketplaceAgents, getSubscribedOpcs } from "@/lib/db/queries";
import { SubscribeButton } from "./subscribe-button";

/**
 * OPC 交易市场：服务商城页
 *
 * 展示全部已上架公共 OPC（listingStatus=listed）。
 * - 企业账号：显示「订阅」或「已订阅·取消订阅」按钮
 * - 个人账号：仅浏览市场行情（无订阅按钮）
 *
 * 所有登录用户均可浏览。
 */
export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; categoryId?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  const [agents, subscribedOpcs] = await Promise.all([
    getMarketplaceAgents({
      categoryId: params.categoryId ?? null,
      search: params.search ?? null,
    }),
    session?.user?.enterpriseId
      ? getSubscribedOpcs(session.user.enterpriseId)
      : [],
  ]);

  const isEnterprise = session?.user?.accountType === "enterprise";
  // 已订阅的 agentId 集合
  const subscribedAgentIds = new Set(subscribedOpcs.map((s) => s.agent.id));

  return (
    <main className="page-container mx-auto max-w-6xl pb-tabbar">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">OPC 服务商城</h1>
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
          className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground"
        />
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          搜索
        </button>
      </form>

      {agents.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground">暂无已上架的公共 OPC</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                <div className="mb-4 flex items-baseline gap-4">
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
                  {isEnterprise ? (
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
