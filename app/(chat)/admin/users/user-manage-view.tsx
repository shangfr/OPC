"use client";

import { useState, useMemo } from "react";
import {
  Loader2,
  Check,
  X,
  Ban,
  ShieldCheck,
  Search,
  ChevronDown,
} from "lucide-react";
import { toast } from "@/components/chat/toast";

type PendingEnterprise = {
  id: string;
  name: string;
  creditCode: string;
  contactName: string;
  contactPhone: string;
  licenseImage: string | null;
};

type UserItem = {
  id: string;
  email: string;
  name: string | null;
  accountType: string;
  role: string;
  bannedAt: string | null;
  bannedReason: string | null;
  createdAt: string;
  planName: string;
  subscriptionStatus: string | null;
  enterpriseName: string | null;
  enterpriseVerifyStatus: string | null;
};

// 用户类型层级映射
function getUserTypeLabel(u: UserItem): { text: string; className: string } {
  // 平台管理员（admin 角色 + 个人账号）
  if (u.role === "admin" && u.accountType !== "enterprise") {
    return {
      text: "平台管理员",
      className: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    };
  }
  // 企业管理员（admin 角色 + 企业账号）
  if (u.role === "admin" && u.accountType === "enterprise") {
    return {
      text: "企业管理员",
      className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    };
  }
  // 企业普通用户
  if (u.accountType === "enterprise") {
    return {
      text: "企业用户",
      className: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    };
  }
  // 个人普通用户
  return {
    text: "个人用户",
    className: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  };
}

// 套餐标签映射
function getPlanLabel(plan: string): { text: string; className: string } {
  switch (plan) {
    case "plus":
      return {
        text: "Plus",
        className: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      };
    case "base":
      return {
        text: "Base",
        className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      };
    default:
      return {
        text: "Free",
        className: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
      };
  }
}

export function UserManageView({
  pendingEnterprises,
  users,
  isAdmin,
}: {
  pendingEnterprises: PendingEnterprise[];
  users: UserItem[];
  isAdmin: boolean;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchKeyword =
        !keyword ||
        u.email.toLowerCase().includes(keyword.toLowerCase()) ||
        (u.name ?? "").toLowerCase().includes(keyword.toLowerCase());
      const typeMeta = getUserTypeLabel(u);
      const matchType = typeFilter === "all" || typeMeta.text === typeFilter;
      const matchPlan = planFilter === "all" || u.planName === planFilter;
      return matchKeyword && matchType && matchPlan;
    });
  }, [users, keyword, typeFilter, planFilter]);

  async function reviewEnterprise(
    enterpriseId: string,
    decision: "verified" | "rejected"
  ) {
    setPending(enterpriseId);
    try {
      const res = await fetch("/api/admin/enterprises/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enterpriseId, decision }),
      });
      if (res.ok) {
        toast({
          type: "success",
          description: decision === "verified" ? "已认证通过" : "已驳回",
        });
        window.location.reload();
      } else {
        toast({ type: "error", description: "操作失败" });
      }
    } finally {
      setPending(null);
    }
  }

  async function toggleBan(userId: string, currentlyBanned: boolean) {
    if (!currentlyBanned) {
      const reason = prompt("请输入封禁理由：");
      if (!reason) return;
      setPending(userId);
      const res = await fetch("/api/admin/users/ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, reason }),
      });
      if (res.ok) {
        toast({ type: "success", description: "已封禁" });
        window.location.reload();
      }
    } else {
      setPending(userId);
      const res = await fetch("/api/admin/users/ban", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        toast({ type: "success", description: "已解封" });
        window.location.reload();
      }
    }
    setPending(null);
  }

  async function handleUpdateUser(
    userId: string,
    updates: {
      role?: "admin" | "user";
      accountType?: "personal" | "enterprise";
      planName?: "free" | "base" | "plus";
    }
  ) {
    setPending(userId);
    try {
      const res = await fetch("/api/admin/users/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...updates }),
      });
      if (res.ok) {
        toast({ type: "success", description: "已更新用户信息" });
        setEditingUser(null);
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        toast({
          type: "error",
          description: data.error ?? "操作失败",
        });
      }
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-8 space-y-8">
      {/* 企业资质审核 */}
      <section>
        <h2 className="text-lg font-medium text-foreground">企业资质审核</h2>
        <div className="mt-4 space-y-3">
          {pendingEnterprises.length === 0 && (
            <p className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">
              暂无待审核企业
            </p>
          )}
          {pendingEnterprises.map((e) => (
            <div
              key={e.id}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{e.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    信用代码：{e.creditCode} · 联系人：{e.contactName}{" "}
                    {e.contactPhone}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => reviewEnterprise(e.id, "verified")}
                    disabled={pending === e.id}
                    className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {pending === e.id ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Check className="size-3" />
                    )}
                    认证通过
                  </button>
                  <button
                    onClick={() => reviewEnterprise(e.id, "rejected")}
                    disabled={pending === e.id}
                    className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent disabled:opacity-50"
                  >
                    <X className="size-3" />
                    驳回
                  </button>
                </div>
              </div>
              {e.licenseImage && (
                <a
                  href={e.licenseImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs text-primary hover:underline"
                >
                  查看营业执照
                </a>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 用户列表 + 封禁 + 套餐管理 */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-foreground">用户列表</h2>
          <span className="text-xs text-muted-foreground">
            共 {filteredUsers.length} / {users.length} 人
          </span>
        </div>

        {/* 筛选栏 */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索邮箱或姓名..."
              className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="all">全部类型</option>
            <option value="个人用户">个人用户</option>
            <option value="平台管理员">平台管理员</option>
            <option value="企业用户">企业用户</option>
            <option value="企业管理员">企业管理员</option>
          </select>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="all">全部套餐</option>
            <option value="free">Free</option>
            <option value="base">Base</option>
            <option value="plus">Plus</option>
          </select>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 text-left">邮箱</th>
                <th className="whitespace-nowrap px-4 py-3 text-left">姓名</th>
                <th className="whitespace-nowrap px-4 py-3 text-left">用户类型</th>
                <th className="whitespace-nowrap px-4 py-3 text-left">订阅套餐</th>
                <th className="whitespace-nowrap px-4 py-3 text-left">所属企业</th>
                <th className="whitespace-nowrap px-4 py-3 text-left">状态</th>
                <th className="whitespace-nowrap px-4 py-3 text-left">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    没有匹配的用户
                  </td>
                </tr>
              )}
              {filteredUsers.map((u) => {
                const typeMeta = getUserTypeLabel(u);
                const planMeta = getPlanLabel(u.planName);
                return (
                  <tr key={u.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-foreground">
                      {u.email}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.name ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${typeMeta.className}`}
                      >
                        {typeMeta.text}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${planMeta.className}`}
                      >
                        {planMeta.text}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {u.enterpriseName ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      {u.bannedAt ? (
                        <span className="rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                          已封禁
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                          正常
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {/* 平台管理员可调整用户类型与套餐 */}
                        {isAdmin && (
                          <button
                            onClick={() => setEditingUser(u)}
                            disabled={pending === u.id}
                            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-foreground hover:bg-accent disabled:opacity-50"
                            title="调整类型与套餐"
                          >
                            <ChevronDown className="size-3" />
                            管理
                          </button>
                        )}
                        {u.role !== "admin" && (
                          <button
                            onClick={() => toggleBan(u.id, !!u.bannedAt)}
                            disabled={pending === u.id}
                            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs disabled:opacity-50 ${
                              u.bannedAt
                                ? "border border-border text-foreground hover:bg-accent"
                                : "border border-destructive/30 text-destructive hover:bg-destructive/10"
                            }`}
                          >
                            {pending === u.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : u.bannedAt ? (
                              <ShieldCheck className="size-3" />
                            ) : (
                              <Ban className="size-3" />
                            )}
                            {u.bannedAt ? "解封" : "封禁"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 用户类型说明 */}
        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">用户类型说明</p>
          <ul className="mt-2 space-y-1">
            <li>· <strong>个人用户</strong>：普通个人账号，仅管理自己的 OPC 与数据。</li>
            <li>· <strong>平台管理员</strong>：拥有最高权限，可查看所有用户、调整用户类型与套餐、管理全部 OPC。</li>
            <li>· <strong>企业用户</strong>：归属于某企业的普通成员，使用企业共享资源。</li>
            <li>· <strong>企业管理员</strong>：企业管理者，可查看与管理本企业内的所有用户。</li>
          </ul>
        </div>
      </section>

      {/* 用户管理弹窗（调整类型与套餐） */}
      {editingUser && (
        <EditUserDialog
          user={editingUser}
          pending={pending === editingUser.id}
          onClose={() => setEditingUser(null)}
          onSubmit={handleUpdateUser}
        />
      )}
    </div>
  );
}

// 用户管理弹窗组件
function EditUserDialog({
  user,
  pending,
  onClose,
  onSubmit,
}: {
  user: UserItem;
  pending: boolean;
  onClose: () => void;
  onSubmit: (
    userId: string,
    updates: {
      role?: "admin" | "user";
      accountType?: "personal" | "enterprise";
      planName?: "free" | "base" | "plus";
    }
  ) => void;
}) {
  const [role, setRole] = useState<"admin" | "user">(
    user.role as "admin" | "user"
  );
  const [accountType, setAccountType] = useState<"personal" | "enterprise">(
    user.accountType as "personal" | "enterprise"
  );
  const [planName, setPlanName] = useState<"free" | "base" | "plus">(
    (user.planName as "free" | "base" | "plus") ?? "free"
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-medium text-foreground">用户管理</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {user.email} · {user.name ?? "未设置姓名"}
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">账号类型</label>
            <select
              value={accountType}
              onChange={(e) =>
                setAccountType(e.target.value as "personal" | "enterprise")
              }
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="personal">个人账号</option>
              <option value="enterprise">企业账号</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">管理员角色</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "user")}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="user">普通用户</option>
              <option value="admin">
                {accountType === "enterprise" ? "企业管理员" : "平台管理员"}
              </option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              {accountType === "enterprise"
                ? "企业管理员可管理本企业内所有用户"
                : "平台管理员拥有最高权限，可管理所有用户"}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">订阅套餐</label>
            <select
              value={planName}
              onChange={(e) =>
                setPlanName(e.target.value as "free" | "base" | "plus")
              }
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="free">Free（免费）</option>
              <option value="base">Base（基础版）</option>
              <option value="plus">Plus（高级版）</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-accent"
          >
            取消
          </button>
          <button
            onClick={() => onSubmit(user.id, { role, accountType, planName })}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
