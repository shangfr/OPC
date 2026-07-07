import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { TicketCards } from "@/app/(chat)/admin/tickets/ticket-cards";

/**
 * /tickets 页面（供需发布）
 *
 * 所有登录用户可通过卡片视图浏览/发布供需信息。
 */
export default async function TicketsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <TicketCards />;
}
