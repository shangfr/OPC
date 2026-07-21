"use client";

import {
  Camera,
  Check,
  Loader2,
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
import { ThemeToggle } from "@/components/theme-toggle";

interface ProfileUserData {
  id: string;
  name: string;
  email: string;
  image: string;
  phone: string;
  role?: string | null;
  accountType?: string | null;
  teamRole?: string | null;
  planName?: string | null;
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

  const roleBadge = isAdmin
    ? { text: "平台管理员", className: "bg-primary/10 text-primary" }
    : { text: `${user.planName ?? "free"} 套餐`, className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };

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

        {/* ===== 头像 + 用户名 ===== */}
        <section className={cn("mb-6", cardVariants({ variant: "base", padding: "lg" }))}>
          <h2 className="mb-6 text-base font-semibold">头像与用户名</h2>

          <div className="mb-6 flex items-center gap-6">
            <div className="relative">
              {/* 1. 给直接包裹 Image 的 div 添加 relative，确保 fill 定位准确 */}
              <div className="relative size-20 overflow-hidden rounded-full ring-2 ring-border">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt="头像"
                    fill
                    // 2. 移除 size-full，fill 模式下只需要 object-cover 即可填充
                    className="object-cover" 
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
              <span className="text-sm text-muted-foreground">当前套餐</span>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", roleBadge.className)}>
                {roleBadge.text}
              </span>
            </div>
          </div>
        </section>

        {/* ===== 快捷操作 ===== */}
                <ThemeToggle />
      </div>
    </main>
  );
}
