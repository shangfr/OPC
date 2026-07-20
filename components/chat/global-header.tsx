"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Bot,
  ClipboardList,
  LayoutDashboard,
  Users,
  PackageCheck,
  Boxes,
  Receipt,
  Shield,
  Pin,
  Package,
  DollarSign,
  Building2,
  CreditCard,
  ShoppingCart,
  Home,
  PenSquare,
  UserCircle,
  type LucideIcon,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { KeyboardShortcutsHelp } from "./keyboard-shortcuts-help";
import { useHeaderActions } from "./header-actions-context";
import { toast } from "sonner";

const EXCLUDED_PATHS = ["/chat"];

// 路由标题 + 图标映射（参考主流平台 Header 的「图标 + 标题」面包屑样式）
const ROUTE_TITLES: {
  path: string;
  title: string;
  icon: LucideIcon;
  exact?: boolean;
}[] = [
  { path: "/", title: "首页", icon: Home, exact: true },
  { path: "/profile", title: "个人中心", icon: UserCircle },
  { path: "/knowledge", title: "知识库", icon: Bot },
  { path: "/tickets", title: "供需大厅", icon: ClipboardList },
  { path: "/explore", title: "OPC 智库", icon: Bot },
  { path: "/admin/stats", title: "数据看板", icon: LayoutDashboard },
  { path: "/admin/users", title: "用户管理", icon: Users },
  { path: "/admin/applications", title: "上架审核", icon: PackageCheck },
  { path: "/admin/opcs", title: "OPC 管理", icon: Boxes },
  { path: "/admin/orders", title: "订单流水", icon: Receipt },
  { path: "/admin", title: "管理后台", icon: Shield, exact: true },
  { path: "/pinned", title: "信息汇聚", icon: Pin },
  { path: "/artifacts", title: "AI 交付物品库", icon: Package },
  { path: "/creator", title: "创作者中心", icon: DollarSign },
  { path: "/team", title: "团队设置", icon: Building2 },
  { path: "/settings", title: "订阅管理", icon: CreditCard },
  { path: "/marketplace", title: "OPC 交易市场", icon: ShoppingCart },
];

function getPageMeta(pathname: string): { title: string; icon: LucideIcon } {
  const prefixMatches = ROUTE_TITLES.filter(
    (r) => r.exact ? pathname === r.path : pathname === r.path || pathname.startsWith(r.path + "/")
  );
  if (prefixMatches.length === 0) {
    return { title: "OPC Bot", icon: Bot };
  }
  prefixMatches.sort((a, b) => b.path.length - a.path.length);
  return { title: prefixMatches[0].title, icon: prefixMatches[0].icon };
}

export function GlobalHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { actions } = useHeaderActions();

  const shouldShowHeader =
    !EXCLUDED_PATHS.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );

  if (!shouldShowHeader) {
    return null;
  }

  // 移动端首页有自己的顶部品牌区，通过 CSS 隐藏 GlobalHeader
  const isHome = pathname === "/";
  const { title: pageTitle, icon: PageIcon } = getPageMeta(pathname);

  const handleQuickNewChat = async () => {
    try {
      const res = await fetch("/api/chat/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to create chat");
      const { chatId } = await res.json();
      router.push(`/chat/${chatId}`);
    } catch {
      toast.error("创建对话失败，请重试");
    }
  };

  return (
    <header className={cn("page-header sidebar-inset-header", isHome && "md:block hidden")}>
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-1 h-4" />
        <PageIcon className="size-4 shrink-0 text-muted-foreground" />
        {!isHome && (
          <span className="truncate text-sm font-medium text-foreground/80">
            {pageTitle}
          </span>
        )}
      </div>
      <div className="ml-auto flex items-center gap-2 px-4">
        {actions}
        <Button
          variant="default"
          size="sm"
          className="h-8 gap-1.5 rounded-lg text-[13px] font-medium shadow-sm"
          onClick={handleQuickNewChat}
        >
          <PenSquare className="size-4" />
          <span className="hidden sm:inline">新建对话</span>
        </Button>
        <KeyboardShortcutsHelp />
      </div>
    </header>
  );
}
