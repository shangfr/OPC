import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";

/**
 * 管理后台布局
 *
 * 权限分层（由 proxy.ts 中间件拦截）：
 * - /admin：仅平台管理员（AgentManager）
 * - /admin/applications, /admin/orders, /admin/stats, /admin/tickets, /admin/knowledge：仅平台管理员
 * - /admin/opcs, /admin/users：平台管理员 + 企业团队管理员
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 pb-tabbar sm:px-6 lg:px-8">
      {children}
    </div>
  );
}
