import { Bot, Shield, Crown } from "lucide-react";
import { inArray } from "drizzle-orm";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db/queries";
import { agent } from "@/lib/db/schema";
import { getSubscribedOpcs } from "@/lib/db/queries";
import { ForceDelistView } from "./force-delist-view";

/**
 * 管理员后台：OPC 管理页（含强制下架风控与恢复）。
 * - 平台管理员：查看全部 listed/delisted 的公共 OPC
 * - 企业团队管理员：管理已订阅 OPC 的企业副本（可独立编辑，不影响原始公共 OPC）
 */
export default async function AdminOpcsPage() {
  const session = await auth();
  const isPlatformAdmin = session?.user?.role === "admin";
  const accountType = (session?.user?.accountType as string) ?? "personal";
  const teamRole = (session?.user?.teamRole as string) ?? null;
  const isEnterpriseAdmin = accountType === "enterprise" && (teamRole === "owner" || teamRole === "admin");

  let opcs: any[] = [];

  if (isPlatformAdmin) {
    // 平台管理员：查询全部 listed/delisted 的公共 OPC
    // 新 schema：移除 ownershipType，用 listingStatus=listed/delisted 查询
    opcs = await db
      .select()
      .from(agent)
      .where(
        inArray(agent.listingStatus, ["listed", "delisted"])
      )
      .orderBy(agent.listedAt);
  } else if (isEnterpriseAdmin && session?.user?.enterpriseId) {
    // 企业团队管理员：查看已订阅 OPC 的企业副本
    const subscribed = await getSubscribedOpcs({
      enterpriseId: session.user.enterpriseId,
      currentUserId: session.user.id,
    });
    opcs = subscribed
      .filter((s) => s.clonedAgent)
      .map((s) => s.clonedAgent);
  }

  return (
    <div className="page-container pb-tabbar">
      <div className="flex items-center gap-3">
        <Bot className="size-6 text-primary" />
        <div>
          <h1 className="page-title">OPC 管理</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isPlatformAdmin
              ? "管理平台公共 OPC，可强制下架违规 OPC，也可恢复已下架的 OPC。"
              : "管理企业已订阅的 OPC 副本，可独立编辑不影响原始公共 OPC。"}
          </p>
        </div>
      </div>

      {/* OPC 数量徽标 */}
      <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
        <span className="size-2 rounded-full bg-sky-500" />
        <span className="text-sm font-medium">
          共 {opcs.length} 个 OPC
        </span>
      </div>

      {/* 角色标识横幅：区分平台管理员与企业团队管理员的操作范围 */}
      <div
        className={`mt-4 flex items-start gap-3 rounded-lg border p-4 ${
          isPlatformAdmin
            ? "border-primary/20 bg-primary/[0.04]"
            : "border-blue-500/20 bg-blue-500/[0.04]"
        }`}
      >
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
            isPlatformAdmin ? "bg-primary/10" : "bg-blue-500/10"
          }`}
        >
          {isPlatformAdmin ? (
            <Shield className="size-4 text-primary" />
          ) : (
            <Crown className="size-4 text-blue-600 dark:text-blue-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {isPlatformAdmin ? "平台管理员视图" : "企业团队管理员视图"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isPlatformAdmin
              ? "可管理平台全部已上架/已下架的公共 OPC，支持强制下架违规内容与恢复操作，变更将影响所有订阅该 OPC 的企业团队。"
              : "仅可管理本企业已订阅的 OPC 副本，编辑操作独立于原始公共 OPC，不影响其他团队的使用。如需新增 OPC，请前往交易市场订阅。"}
          </p>
        </div>
      </div>

      {opcs.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Bot className="size-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">暂无 OPC 数据</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isPlatformAdmin
                ? "平台暂无已上架或已下架的公共 OPC"
                : "企业暂未订阅任何 OPC"}
            </p>
          </div>
        </div>
      ) : (
        <ForceDelistView
          opcs={opcs.map((o) => ({
            id: o.id,
            name: o.name,
            listingStatus: o.listingStatus,
            priceMonthly: o.priceMonthly,
            priceYearly: o.priceYearly,
            listedAt: o.listedAt?.toISOString() ?? null,
            delistedAt: o.delistedAt?.toISOString() ?? null,
            delistReason: o.delistReason ?? null,
          }))}
        />
      )}
    </div>
  );
}
