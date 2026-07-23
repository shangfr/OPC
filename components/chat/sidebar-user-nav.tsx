"use client";

import {
  ChevronUp,
  LogOut,
  Moon,
  Sun,
  UserCircle,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { User } from "next-auth";
import { useTheme } from "next-themes";
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
import { cn } from "@/lib/utils";
import { signOutAction } from "./sign-out-action";

type SidebarUser = User & {
  type?: "guest" | "regular";
  accountType?: "personal" | "enterprise" | "platform";
  role?: string | null;
  teamRole?: "owner" | "admin" | "member" | null;
  planName?: string | null;
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

  const isAdmin = user?.role === "admin";
  const planLabel: Record<string, string> = { free: "Free", creator: "Creator", team: "Team", enterprise: "Enterprise" };
  const planName = user?.planName ?? "free";

  const roleBadge = isAdmin
    ? { text: "平台管理员", className: "bg-primary/10 text-primary" }
    : { text: `${planLabel[planName] ?? "Free"} 套餐`, className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {/* 头像 — 点击跳转个人中心
                  使用 span[role=button] 而非 <button>，避免与 SidebarMenuButton
                  渲染出的 <button> 形成嵌套 <button>，从而修复 hydration 错误。 */}
              <span
                role="button"
                tabIndex={0}
                aria-label="个人中心"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push("/profile");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    router.push("/profile");
                  }
                }}
                className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {user?.image ? (
                  <Image
                    src={user.image}
                    alt={user.email || "用户头像"}
                    fill
                    className="size-full object-cover"
                    unoptimized
                    // 删除了 width={32} 和 height={32}
                  />
                ) : (
                  <div className="flex size-full items-center justify-center bg-primary/10 text-sm font-bold text-primary">
                    {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
                  </div>
                )}

              </span>

              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {user?.name || user?.email?.split("@")[0] || "用户"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {user?.email}
                </span>
              </div>

              <ChevronUp className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side="top"
            align="end"
            sideOffset={4}
          >
            <div className="flex items-center gap-2 px-2 py-1.5">
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", roleBadge.className)}>
                {roleBadge.text}
              </span>
            </div>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="cursor-pointer text-[13px]"
              onSelect={() => router.push("/profile")}
            >
              <span className="mr-2 flex size-6 items-center justify-center rounded-md bg-sky-500/10">
                <UserCircle className="size-3.5 text-sky-500" />
              </span>
              个人中心
            </DropdownMenuItem>

            <DropdownMenuItem
              className="cursor-pointer text-[13px]"
              data-testid="user-nav-item-theme"
              onSelect={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
            >
              {resolvedTheme === "dark" ? (
                <span className="mr-2 flex size-6 items-center justify-center rounded-md bg-amber-500/10">
                  <Sun className="size-3.5 text-amber-500" />
                </span>
              ) : (
                <span className="mr-2 flex size-6 items-center justify-center rounded-md bg-indigo-500/10">
                  <Moon className="size-3.5 text-indigo-500" />
                </span>
              )}
              {`切换${resolvedTheme === "light" ? "暗色" : "亮色"}模式`}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild data-testid="user-nav-item-auth">
              <button
                className="w-full cursor-pointer text-[13px]"
                onClick={() => signOutAction()}
                type="button"
              >
                <span className="mr-2 flex size-6 items-center justify-center rounded-md bg-red-500/10">
                  <LogOut className="size-3.5 text-red-500" />
                </span>
                退出登录
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
