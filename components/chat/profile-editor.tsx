"use client";

import {
  Camera,
  Check,
  Crown,
  CreditCard,
  Loader2,
  LogOut,
  Moon,
  Sun,
  Trash2,
  UserCircle,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cardVariants } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { signOutAction } from "./sign-out-action";

interface ProfileUserData {
  id: string;
  name: string;
  email: string;
  image: string;
  phone: string;
  role?: string | null;
  accountType?: string | null;
  teamRole?: string | null;
}

export function ProfileEditor({ user }: { user: ProfileUserData }) {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user.name || "");
  const [originalName, setOriginalName] = useState(user.name || "");
  const [avatarUrl, setAvatarUrl] = useState(user.image || "");
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const isAdmin = user.role === "admin";
  const isPersonal = user.accountType === "personal";
  const isEnterprise = user.accountType === "enterprise";
  const teamRole = user.teamRole;
  const isEnterpriseAdmin =
    isEnterprise && (teamRole === "owner" || teamRole === "admin");

  const roleBadge = isAdmin
    ? { text: "平台管理员", className: "bg-red-500/10 text-red-600 dark:text-red-400" }
    : isEnterpriseAdmin
      ? { text: "企业管理员", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" }
      : isEnterprise
        ? { text: "企业成员", className: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" }
        : { text: "个人账号", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };

  const nameChanged = name.trim() !== originalName.trim() && name.trim().length > 0;

  const handleSaveName = async () => {
    if (!nameChanged) return;
    setSavingName(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "保存失败");
      }
      setOriginalName(name.trim());
      toast.success("用户名已更新");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败，请重试");
    } finally {
      setSavingName(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/user/avatar", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "上传失败");
      }

      const { url } = await res.json();
      setAvatarUrl(url);
      toast.success("头像已更新");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "头像上传失败，请重试");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <main className="page-container">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 flex items-center gap-3">
          <UserCircle className="size-7 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">个人中心</h1>
        </div>

        {/* ===== 头像 + 用户名 ===== */}
        <section className={cn("mb-6", cardVariants({ variant: "base", padding: "lg" }))}>
          <h2 className="mb-6 text-base font-semibold">头像与用户名</h2>

          <div className="mb-6 flex items-center gap-6">
            <div className="relative">
              <div className="size-20 overflow-hidden rounded-full ring-2 ring-border">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt="头像"
                    fill
                    className="size-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex size-full items-center justify-center bg-muted text-2xl font-bold text-muted-foreground">
                    {(name || user.email || "U").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 flex size-full items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity hover:opacity-100 disabled:opacity-50"
              >
                {uploadingAvatar ? (
                  <Loader2 className="size-5 animate-spin text-white" />
                ) : (
                  <Camera className="size-5 text-white" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                点击头像更换图片
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                支持 JPEG、PNG、GIF、WebP，最大 5MB
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="name" className="font-normal text-muted-foreground">
              用户名
            </Label>
            <div className="flex gap-3">
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="设置你的用户名"
                maxLength={32}
                className="flex-1"
              />
              <Button
                onClick={handleSaveName}
                disabled={!nameChanged || savingName}
                className="gap-1.5"
              >
                {savingName ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                保存
              </Button>
            </div>
          </div>
        </section>

        {/* ===== 账号信息 ===== */}
        <section className={cn("mb-6", cardVariants({ variant: "base", padding: "lg" }))}>
          <h2 className="mb-4 text-base font-semibold">账号信息</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">邮箱</span>
              <span className="text-sm font-medium">{user.email}</span>
            </div>
            {user.phone && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">手机号</span>
                <span className="text-sm font-medium">{user.phone}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">账号角色</span>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", roleBadge.className)}>
                {roleBadge.text}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">账号类型</span>
              <span className="text-sm font-medium">
                {isEnterprise ? "企业账号" : "个人账号"}
              </span>
            </div>
          </div>
        </section>

        {/* ===== 快捷操作 ===== */}
        <section className={cn("mb-6", cardVariants({ variant: "base", padding: "lg" }))}>
          <h2 className="mb-4 text-base font-semibold">快捷操作</h2>
          <div className="space-y-2">
            {isPersonal && !isAdmin && !user.teamRole && (
              <button
                type="button"
                onClick={() => router.push("/register-enterprise")}
                className="flex w-full items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-left transition-colors hover:bg-primary/10"
              >
                <Crown className="size-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-primary">升级企业账号</p>
                  <p className="text-xs text-muted-foreground">解锁团队协作与 OPC 交易市场</p>
                </div>
              </button>
            )}

            <button
              type="button"
              onClick={() => router.push("/settings")}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-muted"
            >
              <CreditCard className="size-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">订阅管理（账单）</p>
                <p className="text-xs text-muted-foreground">查看当前套餐与用量</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-muted"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="size-5 text-muted-foreground" />
              ) : (
                <Moon className="size-5 text-muted-foreground" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">
                  切换{resolvedTheme === "light" ? "暗色" : "亮色"}模式
                </p>
                <p className="text-xs text-muted-foreground">
                  当前为{resolvedTheme === "light" ? "亮色" : "暗色"}模式
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                if (confirm("确定要清空全部对话吗？此操作不可撤销。")) {
                  fetch("/api/history", { method: "DELETE" })
                    .then(() => {
                      toast.success("全部对话已删除");
                      router.refresh();
                    })
                    .catch(() => toast.error("操作失败，请重试"));
                }
              }}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-destructive/5"
            >
              <Trash2 className="size-5 text-destructive/70" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive/70">清空全部对话</p>
                <p className="text-xs text-muted-foreground">永久删除所有对话记录</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => signOutAction()}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-muted"
            >
              <LogOut className="size-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">退出登录</p>
                <p className="text-xs text-muted-foreground">退出当前账号</p>
              </div>
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
