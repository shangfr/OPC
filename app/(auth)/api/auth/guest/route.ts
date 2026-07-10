import { NextResponse } from "next/server";

// 游客模式已下线：所有访问 /api/auth/guest 的请求统一重定向到登录页，
// 强制用户完成注册/登录后才能使用平台功能。
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawRedirect = searchParams.get("redirectUrl") || "/";
  const redirectUrl =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/";

  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return NextResponse.redirect(
    new URL(`${base}/login?redirectUrl=${encodeURIComponent(redirectUrl)}`, request.url)
  );
}
