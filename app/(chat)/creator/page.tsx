import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import {
  getCreatorOpcStats,
  getCreatorRevenueList,
  getCreatorRevenueSummary,
  getAgentsByEnterprise,
} from "@/lib/db/queries";
import { CreatorRevenueView } from "./creator-revenue-view";

/**
 * OPC 交易市场：创作者/团队 OPC 管理中心
 *
 * - 个人账号（创作者）：展示名下 OPC 收益汇总、OPC 列表、收益明细
 * - 企业团队管理员：展示团队 OPC 列表、上架状态管理（收益功能仅个人创作者可用）
 *
 * 仅个人创作者或企业团队管理员可访问（middleware 已拦截企业普通成员）。
 */
export default async function CreatorPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const accountType = (session.user.accountType as "personal" | "enterprise") ?? "personal";
  const teamRole = (session.user.teamRole as string) ?? null;
  const isEnterpriseAdmin = accountType === "enterprise" && (teamRole === "owner" || teamRole === "admin");

  // 企业普通成员不可访问
  if (accountType === "enterprise" && !isEnterpriseAdmin) {
    redirect("/");
  }

  // 个人创作者：加载收益数据
  if (accountType === "personal") {
    const [summary, opcStats, revenueList] = await Promise.all([
      getCreatorRevenueSummary({ userId: session.user.id }),
      getCreatorOpcStats({ userId: session.user.id }),
      getCreatorRevenueList({ userId: session.user.id }),
    ]);

    return (
      <main className="flex flex-1 flex-col gap-8 p-4 md:p-8">
        <CreatorRevenueView
          accountType="personal"
          summary={summary}
          opcStats={opcStats.map((o) => ({
            id: o.id,
            name: o.name,
            description: o.description,
            ownershipType: o.ownershipType,
            listingStatus: o.listingStatus,
            priceMonthly: o.priceMonthly,
            priceYearly: o.priceYearly,
            activeSubscriberCount: o.activeSubscriberCount,
            totalRevenue: o.totalRevenue,
          }))}
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

  // 企业团队管理员：加载本企业全部 OPC（含团队创建 + 订阅副本）
  const teamOpcs = session.user.enterpriseId
    ? await getAgentsByEnterprise(session.user.enterpriseId)
    : [];

  return (
    <main className="flex flex-1 flex-col gap-8 p-4 md:p-8">
      <CreatorRevenueView
        accountType="enterprise"
        summary={{
          totalRevenue: 0,
          monthRevenue: 0,
          opcCount: teamOpcs.length,
          totalSubscriptions: 0,
        }}
        opcStats={teamOpcs.map((o) => ({
          id: o.id,
          name: o.name,
          description: o.description,
          ownershipType: o.ownershipType,
          listingStatus: o.listingStatus,
          priceMonthly: o.priceMonthly,
          priceYearly: o.priceYearly,
          activeSubscriberCount: 0,
          totalRevenue: 0,
        }))}
        revenueList={[]}
      />
    </main>
  );
}
