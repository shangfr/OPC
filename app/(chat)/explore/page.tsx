import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { AgentManager } from "@/app/(chat)/admin/agent-manager";
import { AgentCards } from "@/app/(chat)/admin/agent-cards";

/**
 * /explore 页面（OPC 智库浏览）
 *
 * 按角色渲染不同视图：
 * - 平台管理员：AgentManager（CRUD 管理面板 + 分类管理 + 站点配置）
 * - 其他用户：AgentCards（卡片浏览 + 选择对话 + 创建自己的 OPC）
 *
 * 上架申请权限（canListOpc）：
 * - 个人用户：可对自己创建的 private OPC 申请上架
 * - 企业管理员（owner/admin）：可对本企业 OPC 申请上架
 * - 普通企业成员（member）：无权申请上架（按钮隐藏）
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

  // 计算上架申请权限
  const accountType = (session.user.accountType as "personal" | "enterprise") ?? "personal";
  const teamRole = (session.user.teamRole as string) ?? null;
  // 个人用户 或 企业管理员 可申请上架；普通企业成员不可
  const canListOpc = accountType === "personal" || (accountType === "enterprise" && (teamRole === "owner" || teamRole === "admin"));

  // 其他用户：卡片浏览界面
  return <AgentCards canListOpc={canListOpc} />;
}
