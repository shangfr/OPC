// lib/mobile-tabs.ts
// 移动端底部导航栏配置 —— 按角色生成不同的 Tab 组合
//
// 优化后与桌面端侧边栏导航对齐：
// - 游客/普通用户：首页 + 智库 + 智客 + 智品
// - 企业用户：首页 + 智库 + 智客 + 市场
// - 管理员：首页 + 智库 + 智客 + 看板
//
// 统一使用"智客"（供需大厅 /tickets）替代原来的"汇总"，
// 确保移动端与桌面端导航入口一致。

import {
  Bot,
  FileText,
  Home,
  LayoutDashboard,
  MessageSquare,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import type { TabBarItem } from "@/components/mobile/tab-bar";

type UserRole = "guest" | "user" | "admin";
type AccountType = "personal" | "enterprise";

export function getMobileTabs(
  role: UserRole,
  accountType: AccountType = "personal"
): TabBarItem[] {
  // 管理员：首页 + 智库 + 智客 + 看板
  if (role === "admin") {
    return [
      { path: "/", icon: Home, label: "首页" },
      { path: "/explore", icon: Bot, label: "智库" },
      { path: "/tickets", icon: MessageSquare, label: "智客" },
      { path: "/admin/stats", icon: LayoutDashboard, label: "看板" },
    ];
  }

  // 企业用户：首页 + 智库 + 智客 + 市场
  if (accountType === "enterprise") {
    return [
      { path: "/", icon: Home, label: "首页" },
      { path: "/explore", icon: Bot, label: "智库" },
      { path: "/tickets", icon: MessageSquare, label: "智客" },
      { path: "/marketplace", icon: ShoppingCart, label: "市场" },
    ];
  }

  // 个人用户 / 游客：首页 + 智库 + 智客 + 智品
  return [
    { path: "/", icon: Home, label: "首页" },
    { path: "/explore", icon: Bot, label: "智库" },
    { path: "/tickets", icon: MessageSquare, label: "智客" },
    { path: "/artifacts", icon: FileText, label: "智品" },
  ];
}
