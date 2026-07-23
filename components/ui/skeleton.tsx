"use client";

import { cn } from "@/lib/utils";

/**
 * 骨架屏基础组件
 *
 * 用于在内容加载期间提供占位，避免布局跳动（CLS），
 * 相比纯 Spinner 能更好地传达"内容结构"而非"正在转圈"。
 *
 * 美化：使用 shimmer 渐变扫光动画，比 pulse 更精致、更有"加载中"的流动感。
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden rounded-md bg-muted/50",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:bg-gradient-to-r before:from-transparent before:via-foreground/[0.06] before:to-transparent",
        "before:animate-[skeleton-shimmer_1.8s_ease-in-out_infinite]",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
