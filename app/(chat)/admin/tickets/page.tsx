import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { TicketManager } from "./ticket-manager";

/**
 * /admin/tickets 页面（工单管理后台）
 *
 * 仅平台管理员可访问（由 proxy.ts 中间件拦截）。
 * 渲染 TicketManager：含审核队列、看板视图、统计面板。
 */
export default async function AdminTicketsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <TicketManager />;
}
