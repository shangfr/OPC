import { eq, inArray } from "drizzle-orm";
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
    const subscribed = await getSubscribedOpcs(session.user.enterpriseId);
    opcs = subscribed
      .filter((s) => s.clonedAgent)
      .map((s) => s.clonedAgent);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">OPC 管理</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {isPlatformAdmin
          ? "管理平台公共 OPC，可强制下架违规 OPC，也可恢复已下架的 OPC。"
          : "管理企业已订阅的 OPC 副本，可独立编辑不影响原始公共 OPC。"}
      </p>

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
    </div>
  );
}
