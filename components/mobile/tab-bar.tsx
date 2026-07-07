"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

export interface TabBarItem {
  path: string;
  icon: LucideIcon;
  label: string;
}

interface TabBarProps {
  items: TabBarItem[];
}

/**
 * 移动端底部导航栏
 *
 * 固定 48px 高度（安卓原生标准），自动适配底部安全区。
 * 仅在移动端显示，桌面端隐藏。
 *
 * 用法：
 * <TabBar items={[
 *   { path: '/', icon: Home, label: '首页' },
 *   { path: '/chat', icon: MessageSquare, label: '对话' },
 *   { path: '/mine', icon: User, label: '我的' },
 * ]} />
 */
export default function TabBar({ items }: TabBarProps) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-12 border-t border-border bg-background pb-safe md:hidden">
      {items.map((item) => {
        const isActive =
          pathname === item.path || pathname.startsWith(`${item.path}/`);
        const Icon = item.icon;

        return (
          <Link
            key={item.path}
            href={item.path}
            className={`flex flex-1 flex-col items-center justify-center transition-colors ${
              isActive ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icon className="size-icon-mobile" />
            <span className="mt-0.5 text-xs">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
