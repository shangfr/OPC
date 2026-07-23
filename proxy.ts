import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { guestRegex } from "./lib/constants";
import { hasPlanTier } from "./lib/payments/config";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. 健康检查与 Auth API 放行
  if (pathname.startsWith("/ping")) {
    return new Response("pong", { status: 200 });
  }

  if (pathname.startsWith("/api/auth")) {
    return withSecurityHeaders(NextResponse.next());
  }

  // 2. 获取 Token
  const secureCookie = request.nextUrl.protocol === "https:";
  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET, secureCookie });

  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const isGuest = guestRegex.test(token?.email ?? "");

  const userType = token?.type as string | undefined;
  const isLoggedIn = !!token;
  const isRegular = isLoggedIn && userType === "regular";

  // 角色判断
  const isPlatformAdmin = token?.role === "admin";
  // 套餐驱动型权限：从 token 读取用户套餐
  const userPlan = (token?.planName as string | undefined) ?? "free";

  // 3. 未登录拦截
  const PUBLIC_ROUTES = ["/login", "/register", "/register-enterprise", "/forgot-password", "/reset-password", "/pricing"];
  const isPublicRoute = PUBLIC_ROUTES.some((p) => pathname.startsWith(p));

  if (!isLoggedIn && !isPublicRoute) {
    return NextResponse.redirect(new URL(`${base}/login?redirectUrl=${encodeURIComponent(pathname)}`, request.url));
  }

  // 4. 已登录但 guest 拦截非公开路由
  if (isGuest && !isPublicRoute) {
    return NextResponse.redirect(new URL(`${base}/login?redirectUrl=${encodeURIComponent(pathname)}`, request.url));
  }

  // 5. 登录/注册页：已登录则跳转首页
  if (isPublicRoute && isRegular && !isGuest) {
    return NextResponse.redirect(new URL(`${base}/`, request.url));
  }

  // 6. /register-enterprise：仅允许未登录用户和 free/creator 套餐用户访问
  if (pathname === "/register-enterprise" && isLoggedIn) {
    if (hasPlanTier(userPlan, "team") || isPlatformAdmin) {
      return NextResponse.redirect(new URL(`${base}/`, request.url));
    }
  }

  // 7. /team 路由：需要 Team 套餐及以上
  if (pathname.startsWith("/team") && !hasPlanTier(userPlan, "team") && !isPlatformAdmin) {
    return NextResponse.redirect(new URL(`${base}/`, request.url));
  }

  // 8. /creator 路由：需要 Creator 套餐及以上
  if (pathname.startsWith("/creator") && !hasPlanTier(userPlan, "creator") && !isPlatformAdmin) {
    return NextResponse.redirect(new URL(`${base}/`, request.url));
  }

  // 9. /marketplace 路由：需要 Team 套餐及以上（OPC 订阅功能）
  if (pathname.startsWith("/marketplace") && !hasPlanTier(userPlan, "team") && !isPlatformAdmin) {
    return NextResponse.redirect(new URL(`${base}/`, request.url));
  }

  // 10. /admin 路由权限分层
  //     /admin（管理后台首页）→ 仅平台管理员
  //     /admin/applications → 仅平台管理员
  //     /admin/orders → 仅平台管理员
  //     /admin/stats → 仅平台管理员
  //     /admin/users → 平台管理员 + Team 套餐及以上用户
  //     /admin/tickets → 仅平台管理员（供需管理后台）
  //     /admin/knowledge → 仅平台管理员（知识库管理后台）
  if (pathname.startsWith("/admin")) {
    const PLATFORM_ADMIN_ONLY = [
      "/admin/applications",
      "/admin/orders",
      "/admin/stats",
      "/admin/tickets",
      "/admin/knowledge",
    ];
    const TEAM_PLAN_ALLOWED = [
      "/admin/users",
    ];

    // /admin 本身仅平台管理员
    if (pathname === "/admin" && !isPlatformAdmin) {
      return NextResponse.redirect(new URL(`${base}/explore`, request.url));
    }

    // 平台专属路由
    if (PLATFORM_ADMIN_ONLY.some((p) => pathname.startsWith(p)) && !isPlatformAdmin) {
      return NextResponse.redirect(new URL(`${base}/`, request.url));
    }

    // Team 套餐可访问路由
    if (TEAM_PLAN_ALLOWED.some((p) => pathname.startsWith(p)) && !isPlatformAdmin && !hasPlanTier(userPlan, "team")) {
      return NextResponse.redirect(new URL(`${base}/`, request.url));
    }
  }

  return withSecurityHeaders(NextResponse.next());
}

/**
 * 为响应注入安全 headers
 */
function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(self), geolocation=(self)");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  response.headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; media-src 'self' blob: https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  return response;
}

export const config = {
  // 排除静态资源（API 路由已纳入 middleware 处理）
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
