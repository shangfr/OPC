import { redirect } from "next/navigation";

/**
 * 定价页已合并到订阅管理页（/settings）。
 * 保留路由以兼容旧链接，自动重定向到 /settings。
 */
export default function PricingPage() {
  redirect("/settings");
}
