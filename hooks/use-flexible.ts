"use client";

import { useEffect } from "react";

/**
 * 移动端 rem 自适应钩子
 *
 * 原理：
 * - 设计稿统一按 375px 移动端稿来写代码
 * - JS 动态设置 html 根字体大小，实现 rem 自适应
 * - 仅在移动端（< 768px）启用 rem 缩放，桌面端保持 16px 默认值
 *   避免桌面端布局被放大破坏
 *
 * 解决问题：
 * - 高清屏字发虚、折叠屏/平板字体忽大忽小
 * - 图标自动缩小、异形屏适配
 * - 安卓微信内嵌页面缩放错乱
 */
export function useFlexible() {
  useEffect(() => {
    const DESIGN_WIDTH = 375;
    const BASE_FONT = 16;
    const MOBILE_BREAKPOINT = 768;
    const MAX_MOBILE_WIDTH = 750;

    function setRootFontSize() {
      let width = document.documentElement.clientWidth;

      // 桌面端：恢复默认 16px，不参与 rem 缩放
      if (width >= MOBILE_BREAKPOINT) {
        document.documentElement.style.fontSize = "";
        return;
      }

      // 移动端：限制最大宽度 750px，平板大屏不再继续放大
      if (width > MAX_MOBILE_WIDTH) {
        width = MAX_MOBILE_WIDTH;
      }

      const fontSize = (width / DESIGN_WIDTH) * BASE_FONT;
      document.documentElement.style.fontSize = `${fontSize}px`;
    }

    setRootFontSize();

    window.addEventListener("resize", setRootFontSize);
    window.addEventListener("orientationchange", setRootFontSize);

    return () => {
      window.removeEventListener("resize", setRootFontSize);
      window.removeEventListener("orientationchange", setRootFontSize);
      // 卸载时恢复默认
      document.documentElement.style.fontSize = "";
    };
  }, []);
}
