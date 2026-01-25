// middleware.js
import { NextResponse } from "next/server";
import { clearSupabaseCookies, getSbCookieNamesFromRequest } from "@/lib/authCookies";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request) {
  const diagEnabled =
    process.env.NEXT_PUBLIC_AUTH_DIAG === "1" &&
    process.env.NODE_ENV !== "production";
  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith("/api/");
  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/public/")
  ) {
    return NextResponse.next();
  }
  const isPublicBusinessRoute =
    pathname === "/business" ||
    pathname === "/business/" ||
    pathname.startsWith("/business/about") ||
    pathname.startsWith("/business/login");
  if (isPublicBusinessRoute) {
    return NextResponse.next();
  }
  const hasAuthCookie = getSbCookieNamesFromRequest(request).length > 0;

  if (!isApiRoute && !hasAuthCookie) {
    const redirectUrl = new URL("/?redirected=1", request.url);
    if (diagEnabled) {
      console.warn("[AUTH_DIAG] route_guard:redirect", {
        from: pathname,
        to: redirectUrl.pathname + redirectUrl.search,
        reason: "missing_auth_cookie",
      });
    }
    return NextResponse.redirect(redirectUrl);
  }

  if (pathname.startsWith("/api/auth/") || pathname === "/api/logout") {
    return NextResponse.next();
  }

  const response = await updateSession(request);
  const refreshError = response.headers.get("x-supabase-refresh-error");
  if (refreshError === "refresh_token_already_used") {
    if (isApiRoute) {
      const apiResponse = NextResponse.json(
        { error: "session_refresh_failed" },
        { status: 401 }
      );
      clearSupabaseCookies(apiResponse, request, {
        isProd: process.env.NODE_ENV === "production",
      });
      return apiResponse;
    }

    const redirectUrl = new URL("/?redirected=1", request.url);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    clearSupabaseCookies(redirectResponse, request, {
      isProd: process.env.NODE_ENV === "production",
    });
    return redirectResponse;
  }

  if (diagEnabled) {
    const hasRsc =
      request.headers.get("RSC") === "1" ||
      request.headers.has("next-router-state-tree");
    if (hasRsc) {
      console.warn("[AUTH_DIAG] rsc:request", {
        pathname,
        search: request.nextUrl.search,
        method: request.method,
      });
    }
  }
  return response;
}

export const config = {
  matcher: ["/api/:path*", "/customer/:path*", "/business/:path*"],
};
