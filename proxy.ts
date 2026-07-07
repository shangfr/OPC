import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { guestRegex } from "./lib/constants";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. 健康检查与 Auth API 放行
  if (pathname.startsWith("/ping")) {
    return new Response("pong", { status: 200 });
  }

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // 2. 获取 Token
  const secureCookie = request.nextUrl.protocol === "https:";
  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET, secureCookie });

  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const isGuest = guestRegex.test(token?.email ?? "");

  const userType = token?.type as string | undefined;
  const accountType = token?.accountType as string | undefined;
  const teamRole = token?.teamRole as string | undefined;
  const isLoggedIn = !!token;
  const isRegular = isLoggedIn && userType === "regular";

  // 角色判断
  const isPlatformAdmin = token?.role === "admin";
  const isEnterpriseAdmin = accountType === "enterprise" && (teamRole === "owner" || teamRole === "admin");
  const canAccessAdmin = isPlatformAdmin || isEnterpriseAdmin;

  // 3. 未登录用户处理
  if (!token) {
    const PUBLIC_ROUTES = ["/login", "/register", "/register-enterprise", "/forgot-password", "/reset-password", "/pricing"];
    if (PUBLIC_ROUTES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      return NextResponse.next();  // 放行公开路由
    }
  }

  // 4. 游客访问限制
  if (isGuest) {
    const guestAllowed = ["/", "/pricing", "/marketplace"];
    const isAllowed = guestAllowed.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (!isAllowed && !pathname.startsWith("/api/")) {
      return NextResponse.redirect(new URL(`${base}/`, request.url));
    }
    return NextResponse.next();
  }

  // 5. 正式用户访问登录/注册页 → 跳转首页
  const PUBLIC_AUTH_ROUTES = ["/login", "/register", "/register-enterprise", "/forgot-password"];
  if (isRegular && PUBLIC_AUTH_ROUTES.includes(pathname)) {
    return NextResponse.redirect(new URL(`${base}/`, request.url));
  }

  // 6. 个人设置页：仅正式用户
  if (pathname.startsWith("/settings") && !isRegular) {
    return NextResponse.redirect(new URL(`${base}/login`, request.url));
  }

  // 7. 团队设置页：仅企业账号
  if (pathname.startsWith("/team") && accountType !== "enterprise") {
    return NextResponse.redirect(new URL(`${base}/`, request.url));
  }

  // 8. 创作者中心：个人账号 + 企业团队管理员
  if (pathname.startsWith("/creator")) {
    if (accountType === "enterprise" && !isEnterpriseAdmin) {
      return NextResponse.redirect(new URL(`${base}/`, request.url));
    }
    if (accountType !== "personal" && !isEnterpriseAdmin) {
      return NextResponse.redirect(new URL(`${base}/`, request.url));
    }
  }

  // 9. /admin 路由权限分层
  //    /admin（管理后台首页）→ 仅平台管理员
  //    /admin/applications → 仅平台管理员
  //    /admin/orders → 仅平台管理员
  //    /admin/stats → 仅平台管理员
  //    /admin/opcs → 平台管理员 + 企业团队管理员
  //    /admin/users → 平台管理员 + 企业团队管理员
  //    /admin/tickets → 仅平台管理员（供需管理后台）
  //    /admin/knowledge → 仅平台管理员（知识库管理后台）
  if (pathname.startsWith("/admin")) {
    const PLATFORM_ADMIN_ONLY = [
      "/admin/applications",
      "/admin/orders",
      "/admin/stats",
      "/admin/tickets",
      "/admin/knowledge",
    ];
    const TEAM_ADMIN_ALLOWED = [
      "/admin/opcs",
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

    // 团队管理路由
    if (TEAM_ADMIN_ALLOWED.some((p) => pathname.startsWith(p)) && !canAccessAdmin) {
      return NextResponse.redirect(new URL(`${base}/`, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  // 排除静态资源、API、Auth.js 自身路由
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
