import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { AgentManager } from "./agent-manager";

/**
 * /admin 主页面（平台管理后台）
 *
 * 仅平台管理员可访问。企业团队管理员和普通用户请使用：
 * - /explore — OPC 智库浏览
 * - /workspace — 我的 OPC 管理
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

  return <AgentManager />;
}
