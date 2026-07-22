"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Bot,
  ClipboardList,
  LayoutDashboard,
  Users,
  PackageCheck,
  Boxes,
  BookOpen,
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
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { KeyboardShortcutsHelp } from "./keyboard-shortcuts-help";
import { useHeaderActions } from "./header-actions-context";
import { toast } from "sonner";

// 这些页面有自己的 page-header（含上下文操作按钮），不渲染 GlobalHeader 避免重复
const EXCLUDED_PATHS = ["/chat"];

// 路由标题 + 图标 + 描述映射
const ROUTE_TITLES: {
  path: string;
  title: string;
  description: string;
  icon: LucideIcon;
  exact?: boolean;
}[] = [
  { path: "/", title: "首页", description: "开始对话，探索 AI 助手的无限可能", icon: Home, exact: true },
  { path: "/profile", title: "个人中心", description: "管理个人信息与账户安全", icon: UserCircle },
  { path: "/knowledge", title: "知识库", description: "管理知识库与文档，为 OPC 提供检索增强", icon: BookOpen },
  { path: "/tickets", title: "供需大厅", description: "发布与浏览供需信息，AI 资源整合引擎", icon: ClipboardList },
  { path: "/explore", title: "OPC 智库", description: "浏览和管理平台 OPC 角色", icon: Bot },
  { path: "/admin/stats", title: "数据看板", description: "平台运营数据可视化分析", icon: LayoutDashboard },
  { path: "/admin/users", title: "用户管理", description: "管理平台用户与权限", icon: Users },
  { path: "/admin/applications", title: "上架审核", description: "审核 OPC 上架申请", icon: PackageCheck },
  { path: "/admin/opcs", title: "OPC 管理", description: "管理平台 OPC 角色与分类", icon: Boxes },
  { path: "/admin/orders", title: "订单流水", description: "查看订阅与交易订单记录", icon: Receipt },
  { path: "/admin", title: "管理后台", description: "平台管理控制台", icon: Shield, exact: true },
  { path: "/pinned", title: "信息汇聚", description: "置顶对话汇总与分析", icon: Pin },
  { path: "/artifacts", title: "AI 交付物品库", description: "管理 AI 生成的文档与制品", icon: Package },
  { path: "/creator", title: "创作者中心", description: "管理你的 OPC 创作与收益", icon: DollarSign },
  { path: "/team", title: "团队设置", description: "管理团队成员与权限", icon: Building2 },
  { path: "/settings", title: "订阅管理", description: "管理订阅套餐与支付方式", icon: CreditCard },
  { path: "/marketplace", title: "OPC 交易市场", description: "发现并订阅优质 OPC 角色", icon: ShoppingCart },
];

function getPageMeta(pathname: string): { title: string; description: string; icon: LucideIcon } {
  const prefixMatches = ROUTE_TITLES.filter(
    (r) => r.exact ? pathname === r.path : pathname === r.path || pathname.startsWith(r.path + "/")
  );
  if (prefixMatches.length === 0) {
    return { title: "OPC Bot", description: "AI 智能助手平台", icon: Bot };
  }
  prefixMatches.sort((a, b) => b.path.length - a.path.length);
  return { title: prefixMatches[0].title, description: prefixMatches[0].description, icon: prefixMatches[0].icon };
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
  const { title: pageTitle, description: pageDescription, icon: PageIcon } = getPageMeta(pathname);

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
      <div className="flex min-w-0 items-center gap-2">
        {/* 移动端侧边栏触发器：桌面端由侧边栏自身控制 */}
        <SidebarTrigger className="-ml-1 md:hidden" />
        <Separator orientation="vertical" className="mr-1 h-4 md:hidden" />
        <PageIcon className="size-4 shrink-0 text-muted-foreground" />
        {!isHome && (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium text-foreground/80">
              {pageTitle}
            </span>
            <span className="hidden truncate text-[11px] text-muted-foreground/60 sm:block">
              {pageDescription}
            </span>
          </div>
        )}
      </div>

      {/* 右侧操作区：页面注册的上下文按钮 + 快捷键帮助 + 新建对话 */}
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {actions}
        <KeyboardShortcutsHelp />
        <Button
          variant="ghost"
          size="sm"
          className="touch-target gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={handleQuickNewChat}
          aria-label="新建对话"
        >
          <PenSquare className="size-3.5 text-sky-500" />
          <span className="hidden sm:inline">新建对话</span>
        </Button>
      </div>
    </header>
  );
}
