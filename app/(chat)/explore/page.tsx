import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { AgentCards } from "@/app/(chat)/admin/agent-cards";
import { hasPlanTier } from "@/lib/payments/config";

/**
 * /explore 页面（OPC 智库浏览）
 *
 * 所有用户（包括平台管理员）统一展示卡片浏览界面。
 * 管理员如需 CRUD 管理 OPC，请前往 /admin 管理后台。
 *
 * 套餐驱动型权限：
 * - Creator 及以上套餐：可创建并申请上架 OPC
 * - Free 套餐：仅浏览 + 对话，不可创建/上架
 */
export default async function ExplorePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // 套餐驱动：Creator 及以上可创建并申请上架 OPC；管理员拥有完整权限
  const userPlan = session.user.planName ?? "free";
  const isAdmin = session.user.role === "admin";
  const canListOpc = isAdmin || hasPlanTier(userPlan, "creator");

  // 所有用户（含管理员）统一展示卡片浏览界面
  return <AgentCards canListOpc={canListOpc} />;
}
