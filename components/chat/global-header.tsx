"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Bot,
  ClipboardList,
  LayoutDashboard,
  Users,
  PackageCheck,
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
  UserCircle,
  type LucideIcon,
} from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";


import { toast } from "sonner";

// 这些页面有自己的 page-header（含上下文操作按钮），不渲染 GlobalHeader 避免重复
// 首页 `/` 有自己的品牌区（MobileHome / WelcomeDashboard），不渲染 GlobalHeader
const EXCLUDED_PATHS = ["/", "/chat"];

// 路由标题 + 图标 + 描述映射
const ROUTE_TITLES: {
  path: string;
  title: string;
  description: string;
  icon: LucideIcon;
  exact?: boolean;
  color: string;
  bgColor: string;
}[] = [
  { path: "/", title: "首页", description: "开始对话，探索 AI 助手的无限可能", icon: Home, exact: true, color: "text-sky-500", bgColor: "bg-sky-500/10" },
  { path: "/profile", title: "个人中心", description: "管理个人信息与账户安全", icon: UserCircle, color: "text-sky-500", bgColor: "bg-sky-500/10" },
  { path: "/knowledge", title: "知识库", description: "管理知识库与文档，为 OPC 提供检索增强", icon: BookOpen, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  { path: "/tickets", title: "供需大厅", description: "发布与浏览供需信息，AI 资源整合引擎", icon: ClipboardList, color: "text-amber-500", bgColor: "bg-amber-500/10" },
  { path: "/explore", title: "OPC 智库", description: "浏览和管理平台 OPC 角色", icon: Bot, color: "text-rose-500", bgColor: "bg-rose-500/10" },
  { path: "/admin/stats", title: "数据看板", description: "平台运营数据可视化分析", icon: LayoutDashboard, color: "text-fuchsia-500", bgColor: "bg-fuchsia-500/10" },
  { path: "/admin/users", title: "用户管理", description: "管理平台用户与权限", icon: Users, color: "text-pink-500", bgColor: "bg-pink-500/10" },
  { path: "/admin/applications", title: "上架审核", description: "审核 OPC 上架申请", icon: PackageCheck, color: "text-teal-500", bgColor: "bg-teal-500/10" },
  { path: "/admin/orders", title: "订单流水", description: "查看订阅与交易订单记录", icon: Receipt, color: "text-cyan-500", bgColor: "bg-cyan-500/10" },
  { path: "/admin", title: "管理后台", description: "平台管理控制台", icon: Shield, exact: true, color: "text-red-500", bgColor: "bg-red-500/10" },
  { path: "/pinned", title: "信息汇聚", description: "置顶对话汇总与分析", icon: Pin, color: "text-violet-500", bgColor: "bg-violet-500/10" },
  { path: "/artifacts", title: "AI 交付物品库", description: "管理 AI 生成的文档与制品", icon: Package, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  { path: "/creator", title: "创作者中心", description: "管理你的 OPC 创作与收益", icon: DollarSign, color: "text-green-500", bgColor: "bg-green-500/10" },
  { path: "/team", title: "团队设置", description: "管理团队成员与权限", icon: Building2, color: "text-slate-500", bgColor: "bg-slate-500/10" },
  { path: "/settings", title: "订阅管理", description: "管理订阅套餐与账单", icon: CreditCard, color: "text-indigo-500", bgColor: "bg-indigo-500/10" },
  { path: "/marketplace", title: "交易市场", description: "浏览与订阅 OPC 角色", icon: ShoppingCart, color: "text-orange-500", bgColor: "bg-orange-500/10" },
];

function getPageMeta(pathname: string): { title: string; description: string; icon: LucideIcon; color: string; bgColor: string } {
  const prefixMatches = ROUTE_TITLES.filter(
    (r) => r.exact ? pathname === r.path : pathname === r.path || pathname.startsWith(r.path + "/")
  );
  if (prefixMatches.length === 0) {
    return { title: "OPC Bot", description: "AI 智能助手平台", icon: Bot, color: "text-rose-500", bgColor: "bg-rose-500/10" };
  }
  prefixMatches.sort((a, b) => b.path.length - a.path.length);
  return { title: prefixMatches[0].title, description: prefixMatches[0].description, icon: prefixMatches[0].icon, color: prefixMatches[0].color, bgColor: prefixMatches[0].bgColor };
}

export function GlobalHeader() {
  const pathname = usePathname();
  const router = useRouter();

  const shouldShowHeader =
    !EXCLUDED_PATHS.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );

  if (!shouldShowHeader) {
    return null;
  }

  // 移动端首页有自己的顶部品牌区，通过 CSS 隐藏 GlobalHeader
  const isHome = pathname === "/";
  const { title: pageTitle, description: pageDescription, icon: PageIcon, color: pageColor, bgColor: pageBgColor } = getPageMeta(pathname);

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
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", pageBgColor)}>
          <PageIcon className={cn("size-4", pageColor)} />
        </span>
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
    </header>
  );
}
