import { WelcomeDashboard } from "@/components/chat/welcome-dashboard";
import { auth } from "../(auth)/auth";

export default async function Page() {
  const session = await auth();
  const accountType = (session?.user?.accountType as "personal" | "enterprise") ?? "personal";
  const teamRole = (session?.user?.teamRole as string) ?? null;
  const isEnterpriseAdmin = accountType === "enterprise" && (teamRole === "owner" || teamRole === "admin");

  return (
    <WelcomeDashboard
      accountType={accountType}
      isAdmin={session?.user?.role === "admin"}
      isEnterpriseAdmin={isEnterpriseAdmin}
    />
  );
}
