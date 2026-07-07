"use client";

import { usePathname } from "next/navigation";
import TabBar from "@/components/mobile/tab-bar";
import { getMobileTabs } from "@/lib/mobile-tabs";

// 不显示底部导航栏的路径（聊天页面有自己的输入栏）
const HIDDEN_PATHS = ["/chat"];

/**
 * 移动端底部导航栏包装器
 *
 * 根据用户角色生成不同的 Tab 组合，仅在移动端显示。
 * 聊天页面隐藏底部导航（避免与消息输入栏冲突）。
 *
 * Auth.js v5 纯 Server Component 模式：role 和 accountType 由
 * Server Component（layout.tsx）调用 auth() 获取后通过 prop 传入。
 */
export function MobileTabBar({
  role = "user",
  accountType = "personal",
}: {
  role?: "admin" | "user";
  accountType?: "personal" | "enterprise";
}) {
  const pathname = usePathname();

  // 聊天页面不显示底部导航
  if (HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  const items = getMobileTabs(role, accountType);

  return <TabBar items={items} />;
}
