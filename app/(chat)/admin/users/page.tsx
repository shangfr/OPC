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
      <h1 className="page-title">用户管理</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {isPlatformAdmin
          ? "管理用户账号、审核企业资质、封禁违规账号、调整用户类型与订阅套餐。"
          : "管理团队成员账号、查看成员角色与状态。"}
      </p>

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
    </div>
  );
}
