import { WelcomeDashboard } from "@/components/chat/welcome-dashboard";
import { MobileHome } from "@/components/chat/mobile-home";
import { auth } from "../(auth)/auth";

export default async function Page() {
  const session = await auth();
  const accountType = (session?.user?.accountType as "personal" | "enterprise") ?? "personal";
  const teamRole = (session?.user?.teamRole as string) ?? null;
  const isEnterpriseAdmin = accountType === "enterprise" && (teamRole === "owner" || teamRole === "admin");

  // 登录后首页问候语所需的用户信息（取消游客模式后，session.user 必然存在）
  const userName = (session?.user?.name as string | undefined) || undefined;
  const userEmail = (session?.user?.email as string | undefined) || undefined;
  const userPlan = session?.user?.planName ?? "free";

  return (
    <>
      {/* 移动端首页：单列流式布局 + 常驻底部输入栏 */}
      <div className="md:hidden">
        <MobileHome modelName="GLM-4.1V" userName={userName} />
      </div>

      {/* 桌面端首页：标准双栏布局 */}
      <div className="hidden md:flex">
        <WelcomeDashboard
          accountType={accountType}
          isAdmin={session?.user?.role === "admin"}
          isEnterpriseAdmin={isEnterpriseAdmin}
          userName={userName}
          userEmail={userEmail}
          userPlan={userPlan}
        />
      </div>
    </>
  );
}
