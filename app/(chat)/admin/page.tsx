import { redirect } from "next/navigation";
import { inArray } from "drizzle-orm";
import { Bot } from "lucide-react";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db/queries";
import { agent } from "@/lib/db/schema";
import { AgentManager } from "./agent-manager";
import { ForceDelistView } from "./opcs/force-delist-view";

/**
 * /admin 主页面（平台管理后台）
 *
 * 仅平台管理员可访问。包含：
 * 1. AgentManager — OPC CRUD 管理（创建/编辑/删除/分组/站点配置）
 * 2. ForceDelistView — 上架 OPC 风控管理（强制下架/恢复）
 *
 * 企业团队管理员和普通用户请使用：
 * - /explore — OPC 智库浏览
 * - /marketplace — 交易市场
 */
export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // 仅平台管理员可访问管理后台
  if (session.user.role !== "admin") {
    redirect("/explore");
  }

  // 获取全部已上架/已下架的公共 OPC（原 /admin/opcs 页面逻辑）
  const opcs = await db
    .select()
    .from(agent)
    .where(inArray(agent.listingStatus, ["listed", "delisted"]))
    .orderBy(agent.listedAt);

  return (
    <>
      <AgentManager />

      {/* 上架 OPC 风控管理（原 /admin/opcs 页面内容） */}
      <section className="mt-8 border-t border-border/60 pt-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            上架 OPC 管理
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            管理已上架的公共 OPC，可强制下架违规内容或恢复已下架的 OPC
          </p>
        </div>

        <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
          <span className="size-2 rounded-full bg-sky-500" />
          <span className="text-sm font-medium">
            共 {opcs.length} 个 OPC
          </span>
        </div>

        {opcs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Bot className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">暂无上架 OPC 数据</p>
              <p className="mt-1 text-xs text-muted-foreground">
                平台暂无已上架或已下架的公共 OPC
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
      </section>
    </>
  );
}
