import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import {
  getCurrentTeam,
  listUserTeams,
  getTeamMembers,
} from "@/lib/auth/team-context";
import { getTeamUsage } from "@/lib/quotas/usage";
import { TeamSettingsView } from "./team-settings-view";

/**
 * SaaS 多租户：团队设置页
 *
 * 展示：当前团队信息、成员列表、配额使用情况、创建团队个人账号入口。
 * 仅企业账号可访问（个人账号无团队功能，可申请升级企业账号获得）。
 */
export default async function TeamPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // 仅企业账号可访问团队设置（个人账号无团队功能）
  if (session.user.accountType !== "enterprise") {
    redirect("/");
  }

  const currentTeam = await getCurrentTeam();
  const userTeams = await listUserTeams();
  const usage = currentTeam ? await getTeamUsage(currentTeam.id) : null;
  const members = currentTeam ? await getTeamMembers() : [];

  return (
    <main className="page-container mx-auto max-w-3xl pb-tabbar">
      <h1 className="page-title">团队设置</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        管理你的团队、成员和配额。
      </p>

      <TeamSettingsView
        currentTeam={
          currentTeam
            ? {
                id: currentTeam.id,
                name: currentTeam.name,
                role: currentTeam.role,
                planName: currentTeam.planName,
              }
            : null
        }
        userTeams={userTeams.map((t) => ({
          id: t.id,
          name: t.name,
          role: t.role,
          planName: t.planName,
        }))}
        usage={usage}
        members={members.map((m) => ({
          userId: m.userId,
          email: m.email,
          name: m.name,
          role: m.role,
        }))}
      />
    </main>
  );
}
