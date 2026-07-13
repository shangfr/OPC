import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { AgentManager } from "@/app/(chat)/admin/agent-manager";
import { AgentCards } from "@/app/(chat)/admin/agent-cards";
import { hasPlanTier } from "@/lib/payments/config";

/**
 * /explore 页面（OPC 智库浏览）
 *
 * 套餐驱动型权限：
 * - 平台管理员：AgentManager（CRUD 管理面板 + 分类管理 + 站点配置）
 * - Creator 及以上套餐：AgentCards（卡片浏览 + 创建 OPC + 申请上架）
 * - Free 套餐：AgentCards（仅浏览 + 对话，不可创建/上架）
 */
export default async function ExplorePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const isAdminUser = session.user.role === "admin";

  // 平台管理员：CRUD 管理面板
  if (isAdminUser) {
    return <AgentManager />;
  }

  // 套餐驱动：Creator 及以上可创建并申请上架 OPC
  const userPlan = session.user.planName ?? "free";
  const canListOpc = hasPlanTier(userPlan, "creator");

  // 其他用户：卡片浏览界面
  return <AgentCards canListOpc={canListOpc} />;
}
