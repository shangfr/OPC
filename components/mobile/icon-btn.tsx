"use client";

import React from "react";

interface IconBtnProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  "aria-label"?: string;
}

/**
 * 图标按钮组件
 *
 * 强制 44px 最小触控热区（WCAG / 安卓 Material Design 标准），
 * 解决移动端图标点击区域过小、点不准的问题。
 *
 * 用法：
 * <IconBtn onClick={...} aria-label="返回">
 *   <ArrowLeft className="size-5" />
 * </IconBtn>
 */
export default function IconBtn({
  children,
  onClick,
  className = "",
  "aria-label": ariaLabel,
}: IconBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`flex-shrink-0 flex items-center justify-center min-w-11 min-h-11 p-2 rounded-md active:scale-95 transition-transform ${className}`}
    >
      {children}
    </button>
  );
}
