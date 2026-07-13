"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Crown,
  Shield,
  User as UserIcon,
  UserPlus,
  Mail,
  Trash2,
  Loader2,
} from "lucide-react";
import { switchTeamAction } from "@/lib/teams/actions";
import {
  createTeamMemberAccountAction,
  inviteEnterpriseMemberAction,
  removeTeamMemberAction,
  updateTeamMemberRoleAction,
} from "@/lib/enterprise/actions";
import { toast } from "@/components/chat/toast";

type Usage = {
  planName: string | null;
  maxMessages: number | null;
  usedMessages: number | null;
  usageResetAt: Date | null;
  subscriptionStatus: string | null;
  subscriptionEnd: Date | null;
} | null;

type CurrentTeam = {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
  planName: string | null;
} | null;

type UserTeam = {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
  planName: string | null;
};

type TeamMember = {
  userId: string;
  email: string;
  name: string | null;
  role: "owner" | "admin" | "member";
};

const roleLabel = (role: string) => {
  switch (role) {
    case "owner":
      return "所有者";
    case "admin":
      return "管理员";
    default:
      return "成员";
  }
};

const roleIcon = (role: string) => {
  switch (role) {
    case "owner":
      return <Crown className="mr-2 size-4 text-amber-500" />;
    case "admin":
      return <Shield className="mr-2 size-4 text-primary" />;
    default:
      return <UserIcon className="mr-2 size-4 text-muted-foreground" />;
  }
};

export function TeamSettingsView({
  currentTeam,
  userTeams,
  usage,
  members,
}: {
  currentTeam: CurrentTeam;
  userTeams: UserTeam[];
  usage: Usage;
  members: TeamMember[];
}) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  // 创建团队个人账号表单状态
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);

  // 邀请已有成员表单状态
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const handleSwitch = async (teamId: string) => {
    setSwitching(true);
    const result = await switchTeamAction(teamId);
    if (result.success) {
      toast({ type: "success", description: "团队已切换" });
      router.refresh();
    } else {
      toast({ type: "error", description: result.error ?? "切换失败" });
    }
    setSwitching(false);
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createEmail || !createPassword) {
      toast({ type: "error", description: "请填写邮箱和密码" });
      return;
    }
    if (createPassword.length < 6) {
      toast({ type: "error", description: "密码至少需要 6 个字符" });
      return;
    }
    setCreating(true);
    const result = await createTeamMemberAccountAction({
      email: createEmail,
      password: createPassword,
      name: createName || undefined,
    });
    if (result.success) {
      toast({ type: "success", description: "团队个人账号创建成功" });
      setCreateEmail("");
      setCreatePassword("");
      setCreateName("");
      router.refresh();
    } else {
      toast({ type: "error", description: result.error ?? "创建失败" });
    }
    setCreating(false);
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) {
      toast({ type: "error", description: "请填写邮箱" });
      return;
    }
    setInviting(true);
    const result = await inviteEnterpriseMemberAction({ email: inviteEmail });
    if (result.success) {
      toast({ type: "success", description: "成员邀请成功" });
      setInviteEmail("");
      router.refresh();
    } else {
      toast({ type: "error", description: result.error ?? "邀请失败" });
    }
    setInviting(false);
  };

  // 是否为企业管理员（owner/admin 可管理成员）
  const canManage =
    currentTeam?.role === "owner" || currentTeam?.role === "admin";

  // 移除成员操作状态
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("确定要移除该成员吗？移除后该账号将回归普通个人账号。")) {
      return;
    }
    setRemovingId(userId);
    const result = await removeTeamMemberAction({ userId });
    if (result.success) {
      toast({ type: "success", description: "成员已移除" });
      router.refresh();
    } else {
      toast({ type: "error", description: result.error ?? "移除失败" });
    }
    setRemovingId(null);
  };

  const handleUpdateRole = async (
    userId: string,
    role: "admin" | "member",
  ) => {
    const result = await updateTeamMemberRoleAction({ userId, role });
    if (result.success) {
      toast({ type: "success", description: "角色已更新" });
      router.refresh();
    } else {
      toast({ type: "error", description: result.error ?? "更新失败" });
    }
  };

  return (
    <div className="mt-6 space-y-8">
      {/* 角色标识横幅：区分团队管理员与普通成员的操作权限 */}
      <div
        className={`flex items-start gap-3 rounded-lg border p-4 ${
          canManage
            ? "border-blue-500/20 bg-blue-500/[0.04]"
            : "border-amber-500/20 bg-amber-500/[0.04]"
        }`}
      >
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
            canManage ? "bg-blue-500/10" : "bg-amber-500/10"
          }`}
        >
          {canManage ? (
            <Crown className="size-4 text-blue-600 dark:text-blue-400" />
          ) : (
            <UserIcon className="size-4 text-amber-600 dark:text-amber-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {canManage ? "团队管理员视图" : "团队成员视图（只读）"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {canManage
              ? "可管理团队成员、邀请新成员、调整成员角色与移除成员。团队套餐与配额请在「订阅管理」页面调整。"
              : "仅可查看团队信息、配额使用情况与成员列表。如需邀请成员或调整角色，请联系团队所有者或管理员。"}
          </p>
        </div>
      </div>

      {/* 当前团队信息 */}
      <section className="rounded-xl border border-border bg-background p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">当前团队</p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {currentTeam?.name ?? "未选择团队"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {currentTeam
                ? `${roleLabel(currentTeam.role)} · ${currentTeam.planName ?? "free"}`
                : "请在下方选择团队"}
            </p>
          </div>
          {currentTeam && (
            <div className="flex items-center text-sm text-muted-foreground">
              {roleIcon(currentTeam.role)}
              {roleLabel(currentTeam.role)}
            </div>
          )}
        </div>
      </section>

      {/* 配额使用情况 */}
      {usage && (
        <section className="rounded-xl border border-border bg-background p-5">
          <p className="text-sm font-medium text-foreground">配额使用</p>
          <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">套餐</p>
              <p className="mt-1 font-medium text-foreground">
                {usage.planName ?? "free"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">消息用量</p>
              <p className="mt-1 font-medium text-foreground">
                {usage.usedMessages ?? 0} / {usage.maxMessages ?? "∞"}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 团队成员列表 */}
      {currentTeam && (
        <section className="rounded-xl border border-border bg-background p-5">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              团队成员（{members.length}）
            </p>
          </div>
          <div className="mt-4 space-y-3">
            {members.map((m) => (
              <div
                key={m.userId}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
              >
                <div className="flex items-center">
                  <div className="flex size-8 items-center justify-center rounded-full bg-accent text-xs font-medium text-foreground">
                    {(m.name ?? m.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-foreground">
                      {m.name ?? m.email}
                    </p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* 角色切换 — 仅管理员可操作，且不能操作 owner */}
                  {canManage && m.role !== "owner" && (
                    <button
                      onClick={() =>
                        handleUpdateRole(
                          m.userId,
                          m.role === "admin" ? "member" : "admin",
                        )
                      }
                      className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-accent"
                    >
                      {m.role === "admin" ? "设为成员" : "设为管理员"}
                    </button>
                  )}
                  <div className="flex items-center text-xs text-muted-foreground">
                    {roleIcon(m.role)}
                    {roleLabel(m.role)}
                  </div>
                  {/* 移除成员 — 仅管理员可操作，且不能移除 owner */}
                  {canManage && m.role !== "owner" && (
                    <button
                      onClick={() => handleRemoveMember(m.userId)}
                      disabled={removingId === m.userId}
                      className="ml-1 rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      title="移除成员"
                    >
                      {removingId === m.userId ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 创建团队个人账号 — 仅企业管理员可用 */}
      {canManage && (
        <section className="rounded-xl border border-border bg-background p-5">
          <div className="flex items-center gap-2">
            <UserPlus className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              创建团队个人账号
            </p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            创建的新账号为个人账号，登录后功能与注册个人账号一致（有知识库、创作者中心，无团队管理功能），自动加入当前团队。
          </p>
          <form onSubmit={handleCreateMember} className="mt-4 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">姓名（可选）</label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="请输入姓名"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">邮箱</label>
              <input
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="请输入邮箱"
                required
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">密码</label>
              <input
                type="password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                placeholder="至少 6 个字符"
                required
                minLength={6}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? "创建中..." : "创建账号并加入团队"}
            </button>
          </form>
        </section>
      )}

      {/* 邀请已有成员 — 仅企业管理员可用 */}
      {canManage && (
        <section className="rounded-xl border border-border bg-background p-5">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              邀请已有个人账号加入团队
            </p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            输入已注册的个人账号邮箱，将其加入当前团队。加入后该账号功能与注册个人账号一致。
          </p>
          <form onSubmit={handleInviteMember} className="mt-4 flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="请输入邮箱"
              required
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={inviting}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
            >
              {inviting ? "邀请中..." : "邀请"}
            </button>
          </form>
        </section>
      )}

      {/* 我的团队列表 */}
      {userTeams.length > 0 && (
        <section className="rounded-xl border border-border bg-background p-5">
          <p className="text-sm font-medium text-foreground">我的团队</p>
          <div className="mt-4 space-y-3">
            {userTeams.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
              >
                <div className="flex items-center">
                  {roleIcon(t.role)}
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {t.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {roleLabel(t.role)} · {t.planName ?? "free"}
                    </p>
                  </div>
                </div>
                {t.id === currentTeam?.id ? (
                  <span className="text-xs text-primary">当前</span>
                ) : (
                  <button
                    onClick={() => handleSwitch(t.id)}
                    disabled={switching}
                    className="rounded-md border border-border px-3 py-1 text-xs text-foreground hover:bg-accent disabled:opacity-50"
                  >
                    切换
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 创建新团队 */}
      <section>
        <p className="text-xs text-muted-foreground">
          如需创建新团队，请联系团队所有者或在升级套餐后通过订阅管理创建。
        </p>
      </section>
    </div>
  );
}
