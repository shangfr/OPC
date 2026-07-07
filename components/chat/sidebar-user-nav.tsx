"use client";

import {
  ChevronUp,
  CreditCard,
  Users,
  Tag,
  BarChart3,
  Shield,
  BookOpen,
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
  accountType?: "personal" | "enterprise";
  role?: string | null;
  teamRole?: "owner" | "admin" | "member" | null;
};

export function SidebarUserNav({ user }: { user: SidebarUser }) {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();

  const isGuest = guestRegex.test(user?.email ?? "");
  const isAdmin = user?.role === "admin";
  const isPersonal = user?.accountType === "personal";
  const isEnterprise = user?.accountType === "enterprise";
  const teamRole = user?.teamRole;
  const isEnterpriseAdmin = isEnterprise && (teamRole === "owner" || teamRole === "admin");

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
            {/* SaaS 多租户：团队设置 + 订阅管理（仅正式用户可见，游客隐藏） */}
            {!isGuest && (
              <>
                {/* 管理后台 — 仅平台管理员 */}
                {isAdmin && (
                  <DropdownMenuItem
                    className="cursor-pointer text-[13px]"
                    onSelect={() => router.push("/admin")}
                  >
                    <Shield className="mr-2 size-4" />
                    管理后台
                  </DropdownMenuItem>
                )}

                {/* 创作者中心 / 团队 OPC 管理（个人账号或企业团队管理员） */}
                {(isPersonal || isEnterpriseAdmin) && (
                  <DropdownMenuItem
                    className="cursor-pointer text-[13px]"
                    onSelect={() => router.push("/creator")}
                  >
                    <BarChart3 className="mr-2 size-4" />
                    {isEnterpriseAdmin ? "团队 OPC 管理" : "创作者中心"}
                  </DropdownMenuItem>
                )}

                {/* OPC 服务商城 — 所有用户可浏览 */}
                <DropdownMenuItem
                  className="cursor-pointer text-[13px]"
                  onSelect={() => router.push("/marketplace")}
                >
                  <Tag className="mr-2 size-4" />
                  OPC 服务商城
                </DropdownMenuItem>

                {/* 知识库 — 所有正式用户可用 */}
                <DropdownMenuItem
                  className="cursor-pointer text-[13px]"
                  onSelect={() => router.push("/knowledge")}
                >
                  <BookOpen className="mr-2 size-4" />
                  知识库
                </DropdownMenuItem>

                {/* 团队设置 — 仅企业账号（个人账号无团队功能） */}
                {isEnterprise && (
                  <DropdownMenuItem
                    className="cursor-pointer text-[13px]"
                    onSelect={() => router.push("/team")}
                  >
                    <Users className="mr-2 size-4" />
                    团队设置
                  </DropdownMenuItem>
                )}

                {/* 升级企业账号 — 仅个人账号（升级后获得团队功能） */}
                {isPersonal && (
                  <DropdownMenuItem
                    className="cursor-pointer text-[13px]"
                    onSelect={() => router.push("/register-enterprise")}
                  >
                    <Users className="mr-2 size-4" />
                    升级企业账号
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="cursor-pointer text-[13px]"
                  onSelect={() => router.push("/settings")}
                >
                  <CreditCard className="mr-2 size-4" />
                  订阅管理（账单）
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            <DropdownMenuItem
              className="cursor-pointer text-[13px]"
              data-testid="user-nav-item-theme"
              onSelect={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
            >
              {`切换${resolvedTheme === "light" ? "暗色" : "亮色"}模式`}
            </DropdownMenuItem>
            <DropdownMenuSeparator />

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
                {isGuest ? "登录你的账号" : "退出登录"}
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
