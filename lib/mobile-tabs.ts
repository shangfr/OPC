// lib/mobile-tabs.ts
// 移动端底部导航栏配置 —— 按角色生成不同的 Tab 组合
//
// 参考：微信/钉钉/飞书的底部导航模式
// - 游客/普通用户：首页 + 智库 + 智品 + 我的
// - 企业用户：首页 + 智库 + 交易市场 + 我的
// - 管理员：首页 + 智库 + 数据看板 + 我的

import { Bot, DollarSign, FileText, Home, LayoutDashboard, MessageSquare, ShoppingCart, User } from "lucide-react";
import type { TabBarItem } from "@/components/mobile/tab-bar";

type UserRole = "guest" | "user" | "admin";
type AccountType = "personal" | "enterprise";

export function getMobileTabs(
  role: UserRole,
  accountType: AccountType = "personal"
): TabBarItem[] {
  // 管理员
  if (role === "admin") {
    return [
      { path: "/", icon: Home, label: "首页" },
      { path: "/explore", icon: Bot, label: "智库" },
      { path: "/admin/stats", icon: LayoutDashboard, label: "看板" },
      { path: "/artifacts", icon: FileText, label: "智品" },
    ];
  }

  // 企业用户
  if (accountType === "enterprise") {
    return [
      { path: "/", icon: Home, label: "首页" },
      { path: "/explore", icon: Bot, label: "智库" },
      { path: "/marketplace", icon: ShoppingCart, label: "市场" },
      { path: "/artifacts", icon: FileText, label: "智品" },
    ];
  }

  // 个人用户 / 游客
  return [
    { path: "/", icon: Home, label: "首页" },
    { path: "/explore", icon: Bot, label: "智库" },
    { path: "/artifacts", icon: FileText, label: "智品" },
    { path: "/pinned", icon: MessageSquare, label: "汇总" },
  ];
}
