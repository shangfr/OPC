import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import {
  getCreatorOpcStats,
  getCreatorRevenueList,
  getCreatorRevenueSummary,
  getAgentsByEnterprise,
} from "@/lib/db/queries";
import { hasPlanTier } from "@/lib/payments/config";
import { CreatorRevenueView } from "./creator-revenue-view";

/**
 * 创作者中心：套餐驱动型权限
 *
 * - Creator 及以上套餐：可创建 OPC、查看收益
 * - Free 套餐：重定向至订阅管理页引导升级
 */
export default async function CreatorPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userPlan = session.user.planName ?? "free";
  const isAdmin = session.user.role === "admin";

  // Free 用户不可访问创作者中心
  if (!hasPlanTier(userPlan, "creator") && !isAdmin) {
    redirect("/settings");
  }

  // 所有 Creator+ 用户：加载个人 OPC 收益数据
  const [summary, opcStats, revenueList] = await Promise.all([
    getCreatorRevenueSummary({ userId: session.user.id }),
    getCreatorOpcStats({ userId: session.user.id }),
    getCreatorRevenueList({ userId: session.user.id, currentUserId: session.user.id }),
  ]);

  // Team+ 用户额外加载企业 OPC
  const teamOpcs = hasPlanTier(userPlan, "team") && session.user.enterpriseId
    ? await getAgentsByEnterprise(session.user.enterpriseId)
    : [];

  return (
    <main className="page-container flex flex-1 flex-col gap-6 pb-tabbar sm:gap-8">
      <CreatorRevenueView
        accountType={hasPlanTier(userPlan, "team") ? "enterprise" : "personal"}
        summary={summary}
        opcStats={[
          ...opcStats.map((o) => ({
            id: o.id,
            name: o.name,
            description: o.description,
            ownershipType: o.ownerType,
            listingStatus: o.listingStatus,
            priceMonthly: o.priceMonthly,
            priceYearly: o.priceYearly,
            activeSubscriberCount: o.activeSubscriberCount,
            totalRevenue: o.totalRevenue,
          })),
          ...teamOpcs.map((o) => ({
            id: o.id,
            name: o.name,
            description: o.description,
            ownershipType: o.ownerType,
            listingStatus: o.listingStatus,
            priceMonthly: o.priceMonthly,
            priceYearly: o.priceYearly,
            activeSubscriberCount: 0,
            totalRevenue: 0,
          })),
        ]}
        revenueList={revenueList.map((r) => ({
          id: r.id,
          agentName: r.agentName,
          enterpriseName: r.enterpriseName,
          orderAmount: r.orderAmount,
          revenuePercent: r.revenuePercent,
          revenueAmount: r.revenueAmount,
          settleStatus: r.settleStatus,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </main>
  );
}
