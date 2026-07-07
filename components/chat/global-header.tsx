"use client";

import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { KeyboardShortcutsHelp } from "./keyboard-shortcuts-help";
import { useHeaderActions } from "./header-actions-context";

const EXCLUDED_PATHS = ["/chat"];

// 路由标题映射
const ROUTE_TITLES: { path: string; title: string; exact?: boolean }[] = [
  { path: "/", title: " ", exact: true },
  { path: "/knowledge", title: "知识库" },
  { path: "/tickets", title: "供需大厅" },
  { path: "/explore", title: "OPC 智库" },
  { path: "/admin/stats", title: "数据看板" },
  { path: "/admin/users", title: "用户管理" },
  { path: "/admin/applications", title: "上架审核" },
  { path: "/admin/opcs", title: "OPC 管理" },
  { path: "/admin/orders", title: "订单流水" },
  { path: "/admin", title: "管理后台", exact: true },
  { path: "/pinned", title: "信息汇聚" },
  { path: "/artifacts", title: "AI 交付物品库" },
  { path: "/creator", title: "创作者中心" },
  { path: "/team", title: "团队设置" },
  { path: "/settings", title: "订阅管理" },
  { path: "/marketplace", title: "OPC 交易市场" },
];

function getPageTitle(pathname: string): string {
  // 精确匹配优先
  const exactMatch = ROUTE_TITLES.find(
    (route) => route.exact && pathname === route.path
  );
  if (exactMatch) return exactMatch.title;

  // 前缀匹配：排除 exact 路由（如 "/"），按路径长度降序匹配最具体的
  const prefixMatches = ROUTE_TITLES.filter(
    (route) => !route.exact && pathname.startsWith(route.path)
  );
  // 最长前缀优先
  prefixMatches.sort((a, b) => b.path.length - a.path.length);
  return prefixMatches[0]?.title || "OPC Bot";
}

export function GlobalHeader() {
  const pathname = usePathname();
  const { actions } = useHeaderActions();

  // 在聊天页面不显示全局 Header（聊天页面有自己的 ChatHeader）
  const shouldShowHeader =
    !EXCLUDED_PATHS.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );

  if (!shouldShowHeader) {
    return null;
  }

  const pageTitle = getPageTitle(pathname);

  return (
    <header className="page-header sidebar-inset-header">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <span className="truncate text-sm font-medium text-foreground/80">
          {pageTitle}
        </span>
      </div>
      {/* 右侧操作区：页面注册的主操作按钮 + 键盘快捷键帮助 */}
      <div className="ml-auto flex items-center gap-2 px-4">
        {actions}
        <KeyboardShortcutsHelp />
      </div>
    </header>
  );
}
