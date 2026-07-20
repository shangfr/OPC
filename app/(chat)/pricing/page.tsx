import { redirect } from "next/navigation";

/**
 * 定价页已合并到订阅管理页（/settings）。
 * 保留路由以兼容旧链接，自动重定向到 /settings。
 *
 * 静态生成：此页面仅做重定向，无需动态渲染，强制 SSG 提升性能。
 */
export const dynamic = "force-static";

export default function PricingPage() {
  redirect("/settings");
}
