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

  // 其他用户：卡片浏览界面
  return <AgentCards />;
}
