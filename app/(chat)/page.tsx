import { WelcomeDashboard } from "@/components/chat/welcome-dashboard";
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
    <WelcomeDashboard
      accountType={accountType}
      isAdmin={session?.user?.role === "admin"}
      isEnterpriseAdmin={isEnterpriseAdmin}
      userName={userName}
      userEmail={userEmail}
      userPlan={userPlan}
    />
  );
}
