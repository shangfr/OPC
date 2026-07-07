"use client";

import { cn } from "@/lib/utils";

/**
 * 骨架屏基础组件
 *
 * 用于在内容加载期间提供占位，避免布局跳动（CLS），
 * 相比纯 Spinner 能更好地传达"内容结构"而非"正在转圈"。
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted/60", className)}
      {...props}
    />
  );
}

export { Skeleton };
