/**
 * 移动端底部导航栏配置 — 套餐驱动型
 *
 * 套餐决定底部 Tab 可见性，与桌面端侧边栏逻辑对齐：
 * - Free: 首页 + 智库 + 智客 + 智品
 * - Creator: 首页 + 智库 + 智客 + 创作
 * - Team/Enterprise: 首页 + 智库 + 智客 + 市场
 * - 管理员: 首页 + 智库 + 智客 + 看板
 */

import {
  Bot,
  DollarSign,
  FileText,
  Home,
  LayoutDashboard,
  MessageSquare,
  ShoppingCart,
} from "lucide-react";
import type { TabBarItem } from "@/components/mobile/tab-bar";
import { hasPlanTier } from "@/lib/payments/config";

type UserRole = "user" | "admin";

export function getMobileTabs(
  role: UserRole,
  accountType?: string,
  planName?: string | null,
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

  // Team 及以上：首页 + 智库 + 智客 + 市场
  if (hasPlanTier(planName, "team")) {
    return [
      { path: "/", icon: Home, label: "首页" },
      { path: "/explore", icon: Bot, label: "智库" },
      { path: "/tickets", icon: MessageSquare, label: "智客" },
      { path: "/marketplace", icon: ShoppingCart, label: "市场" },
    ];
  }

  // Creator：首页 + 智库 + 智客 + 创作
  if (hasPlanTier(planName, "creator")) {
    return [
      { path: "/", icon: Home, label: "首页" },
      { path: "/explore", icon: Bot, label: "智库" },
      { path: "/tickets", icon: MessageSquare, label: "智客" },
      { path: "/creator", icon: DollarSign, label: "创作" },
    ];
  }

  // Free：首页 + 智库 + 智客 + 智品
  return [
    { path: "/", icon: Home, label: "首页" },
    { path: "/explore", icon: Bot, label: "智库" },
    { path: "/tickets", icon: MessageSquare, label: "智客" },
    { path: "/artifacts", icon: FileText, label: "智品" },
  ];
}
