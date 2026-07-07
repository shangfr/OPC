import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * 统一卡片设计系统 — 4 种变体
 *
 * base        — 默认容器：统计、知识库列表、表单、错误状态
 * elevated    — 强调展示：Agent 卡片、推荐内容、天气
 * glass       — 毛玻璃浮层：Popover、下拉菜单、toast、slash command
 * interactive — 可点击卡片：Agent 卡片（用户视图）、快速操作入口
 */
const cardVariants = cva("text-card-foreground", {
  variants: {
    variant: {
      base: "rounded-xl border border-border/40 bg-card shadow-[var(--shadow-card)]",
      elevated:
        "rounded-2xl border border-border/50 bg-card shadow-[var(--shadow-float)]",
      glass: "rounded-xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-[var(--shadow-float)]",
      interactive:
        "group rounded-2xl border border-border/50 bg-card shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:border-border hover:shadow-[var(--shadow-float)]",
    },
    padding: {
      none: "",
      sm: "p-3",
      md: "p-4",
      lg: "p-5",
      xl: "p-6",
    },
  },
  defaultVariants: {
    variant: "base",
    padding: "md",
  },
});

interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

function Card({ className, variant, padding, ...props }: CardProps) {
  return (
    <div
      className={cn(cardVariants({ variant, padding, className }))}
      {...props}
    />
  );
}

function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  );
}

function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-sm font-semibold tracking-tight leading-none", className)}
      {...props}
    />
  );
}

function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex-1", className)} {...props} />;
}

function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center", className)}
      {...props}
    />
  );
}

export {
  Card,
  cardVariants,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};
