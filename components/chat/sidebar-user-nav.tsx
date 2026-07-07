"use client";

import {
  ChevronUp,
  CreditCard,
  Users,
  Shield,
  Crown,
  Building2,
  UserCog,
  Trash2,
  Sun,
  Moon,
  LogIn,
  LogOut,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { User } from "next-auth";
import { useTheme } from "next-themes";
import { cardVariants } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { guestRegex } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { signOutAction } from "./sign-out-action";

// 扩展 User 类型以包含 SaaS 字段（与 auth.ts 中的 Session 声明一致）
type SidebarUser = User & {
  type?: "guest" | "regular";
  accountType?: "personal" | "enterprise" | "platform";
  role?: string | null;
  teamRole?: "owner" | "admin" | "member" | null;
};

export function SidebarUserNav({
  user,
  onClearAllChats,
}: {
  user: SidebarUser;
  onClearAllChats?: () => void;
}) {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();

  const isGuest = guestRegex.test(user?.email ?? "");
  const isAdmin = user?.role === "admin";
  const isPersonal = user?.accountType === "personal";
  const isEnterprise = user?.accountType === "enterprise";
  const teamRole = user?.teamRole;
  const isEnterpriseAdmin =
    isEnterprise && (teamRole === "owner" || teamRole === "admin");

  // 角色徽章文本与样式
  const roleBadge = isAdmin
    ? { text: "平台管理员", icon: Shield, className: "bg-red-500/10 text-red-600 dark:text-red-400" }
    : isEnterpriseAdmin
      ? { text: "企业管理员", icon: UserCog, className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" }
      : isEnterprise
        ? { text: "企业成员", icon: Building2, className: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" }
        : isPersonal
          ? { text: "个人账号", icon: Users, className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" }
          : { text: "访客", icon: Users, className: "bg-gray-500/10 text-gray-600 dark:text-gray-400" };

  const RoleBadgeIcon = roleBadge.icon;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className="h-8 px-2 rounded-lg bg-transparent text-sidebar-foreground/70 transition-colors duration-150 hover:text-sidebar-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              data-testid="user-nav-button"
            >
              <div className="size-5 shrink-0 overflow-hidden rounded-full ring-1 ring-sidebar-border/50">
                <Image
                  alt="User"
                  className="size-full object-cover"
                  height={20}
                  src="/icon.png"
                  unoptimized
                  width={20}
                />
              </div>
              <span
                className="truncate text-[13px]"
                data-testid="user-email"
              >
                {isGuest ? "访客" : user?.email}
              </span>
              <ChevronUp className="ml-auto size-3.5 text-sidebar-foreground/50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className={cn(
              "w-(--radix-popper-anchor-width)",
              cardVariants({
                variant: "glass",
                padding: "none",
                className: "rounded-lg",
              })
            )}
            data-testid="user-nav-menu"
            side="top"
          >
            {/* 角色徽章 — 显示当前账号类型与角色 */}
            <div className="flex items-center gap-2 px-3 py-2.5">
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium",
                  roleBadge.className
                )}
              >
                <RoleBadgeIcon className="size-3" />
                {roleBadge.text}
              </div>
            </div>
            <DropdownMenuSeparator />

            {/* 升级企业账号 — 仅个人账号（突出显示，Crown 图标） */}
            {!isGuest && isPersonal && (
              <DropdownMenuItem
                className="cursor-pointer text-[13px] text-primary font-medium"
                onSelect={() => router.push("/register-enterprise")}
              >
                <Crown className="mr-2 size-4" />
                升级企业账号
              </DropdownMenuItem>
            )}

            {/* 订阅管理 — 所有正式用户 */}
            {!isGuest && (
              <DropdownMenuItem
                className="cursor-pointer text-[13px]"
                onSelect={() => router.push("/settings")}
              >
                <CreditCard className="mr-2 size-4" />
                订阅管理（账单）
              </DropdownMenuItem>
            )}

            {/* 清空全部对话 — 从侧边栏底部移入此处，降低误触风险 */}
            {!isGuest && onClearAllChats && (
              <DropdownMenuItem
                className="cursor-pointer text-[13px] text-destructive/70"
                onSelect={onClearAllChats}
              >
                <Trash2 className="mr-2 size-4" />
                清空全部对话
              </DropdownMenuItem>
            )}

            {!isGuest && <DropdownMenuSeparator />}

            {/* 主题切换 */}
            <DropdownMenuItem
              className="cursor-pointer text-[13px]"
              data-testid="user-nav-item-theme"
              onSelect={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
            >
              {resolvedTheme === "dark" ? (
                <Sun className="mr-2 size-4" />
              ) : (
                <Moon className="mr-2 size-4" />
              )}
              {`切换${resolvedTheme === "light" ? "暗色" : "亮色"}模式`}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* 登录/退出 */}
            <DropdownMenuItem asChild data-testid="user-nav-item-auth">
              <button
                className="w-full cursor-pointer text-[13px]"
                onClick={() => {
                  if (isGuest) {
                    router.push("/login");
                  } else {
                    signOutAction();
                  }
                }}
                type="button"
              >
                {isGuest ? (
                  <>
                    <LogIn className="mr-2 size-4" />
                    登录你的账号
                  </>
                ) : (
                  <>
                    <LogOut className="mr-2 size-4" />
                    退出登录
                  </>
                )}
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
