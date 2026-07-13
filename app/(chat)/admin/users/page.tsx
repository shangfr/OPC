import { Users, Shield, Crown } from "lucide-react";
import { auth } from "@/app/(auth)/auth";
import { getAllUsers, getPendingEnterprises, getTeamMembersForAdmin } from "@/lib/db/queries";
import { UserManageView } from "./user-manage-view";

/**
 * 管理员后台：用户管理页（含企业资质审核 + 账号封禁风控 + 套餐/类型管理）。
 * - 平台管理员可查看所有用户并调整其类型与套餐。
 * - 企业团队管理员仅可查看所属团队成员。
 */
export default async function AdminUsersPage() {
  const session = await auth();
  const isPlatformAdmin = session?.user?.role === "admin";
  const accountType = (session?.user?.accountType as string) ?? "personal";
  const teamRole = (session?.user?.teamRole as string) ?? null;
  const isEnterpriseAdmin = accountType === "enterprise" && (teamRole === "owner" || teamRole === "admin");

  let users: any[] = [];
  let pendingEnterprises: any[] = [];

  if (isPlatformAdmin) {
    // 平台管理员：查看所有用户 + 待审核企业
    [users, pendingEnterprises] = await Promise.all([
      getAllUsers({ limit: 100 }),
      getPendingEnterprises(),
    ]);
  } else if (isEnterpriseAdmin && session?.user?.teamId) {
    // 企业团队管理员：仅查看团队成员
    users = await getTeamMembersForAdmin({
      teamId: session.user.teamId,
      currentUserId: session.user.id,
    });
    pendingEnterprises = [];
  }

  return (
    <div className="page-container pb-tabbar">
      <div className="flex items-center gap-3">
        <Users className="size-6 text-primary" />
        <div>
          <h1 className="page-title">用户管理</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isPlatformAdmin
              ? "管理用户账号、审核企业资质、封禁违规账号、调整用户类型与订阅套餐。"
              : "管理团队成员账号、查看成员角色与状态。"}
          </p>
        </div>
      </div>

      {/* 统计徽标 */}
      <div className="mt-4 flex flex-wrap gap-2">
        <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
          <span className="size-2 rounded-full bg-sky-500" />
          <span className="text-sm font-medium">用户 {users.length}</span>
        </div>
        {isPlatformAdmin && pendingEnterprises.length > 0 && (
          <div className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-1.5">
            <span className="size-2 rounded-full bg-amber-500" />
            <span className="text-sm font-medium">待审核企业 {pendingEnterprises.length}</span>
          </div>
        )}
      </div>

      {/* 角色标识横幅：区分平台管理员与企业团队管理员的管辖范围 */}
      <div
        className={`mt-4 flex items-start gap-3 rounded-lg border p-4 ${
          isPlatformAdmin
            ? "border-primary/20 bg-primary/[0.04]"
            : "border-blue-500/20 bg-blue-500/[0.04]"
        }`}
      >
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
            isPlatformAdmin ? "bg-primary/10" : "bg-blue-500/10"
          }`}
        >
          {isPlatformAdmin ? (
            <Shield className="size-4 text-primary" />
          ) : (
            <Crown className="size-4 text-blue-600 dark:text-blue-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {isPlatformAdmin ? "平台管理员视图" : "企业团队管理员视图"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isPlatformAdmin
              ? "可管理平台全部用户，包括审核企业资质、封禁违规账号、调整用户类型与订阅套餐。操作将影响用户的全平台访问权限。"
              : "仅可管理本团队成员，查看成员角色与状态。无法修改成员的账号类型或平台级套餐，如需调整请联系平台管理员。"}
          </p>
        </div>
      </div>

      {users.length === 0 && pendingEnterprises.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Users className="size-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">暂无用户数据</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isPlatformAdmin ? "平台暂无注册用户" : "团队暂无其他成员"}
            </p>
          </div>
        </div>
      ) : (
        <UserManageView
          isAdmin={isPlatformAdmin}
          pendingEnterprises={pendingEnterprises.map((e) => ({
            id: e.id,
            name: e.name,
            creditCode: e.creditCode,
            contactName: e.contactName,
            contactPhone: e.contactPhone,
            licenseImage: e.licenseImage,
          }))}
          users={users.map((u) => ({
            id: u.id,
            email: u.email,
            name: u.name,
            accountType: u.accountType,
            role: u.role,
            bannedAt: u.bannedAt?.toISOString() ?? null,
            bannedReason: u.bannedReason,
            createdAt: u.createdAt.toISOString(),
            planName: (u as any).planName ?? "free",
            subscriptionStatus: (u as any).subscriptionStatus ?? null,
            enterpriseName: (u as any).enterpriseName ?? null,
            enterpriseVerifyStatus: (u as any).enterpriseVerifyStatus ?? null,
          }))}
        />
      )}
    </div>
  );
}
