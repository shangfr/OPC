import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { TicketCards } from "./ticket-cards";

export default async function TicketsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // 恢复为 TicketCards 视图：所有登录用户均通过卡片视图浏览/发布供需信息
  // 管理员如需完整 CRUD，可通过 /admin/tickets/manager 单独访问 TicketManager
  return <TicketCards />;
}
