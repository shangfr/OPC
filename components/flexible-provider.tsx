"use client";

import { useFlexible } from "@/hooks/use-flexible";

/**
 * 客户端包装组件：在根布局中引入 useFlexible 自适应钩子。
 *
 * 根布局保持 Server Component（Next.js 最佳实践），
 * 通过此客户端组件挂载移动端 rem 自适应逻辑。
 */
export function FlexibleProvider() {
  useFlexible();
  return null;
}
