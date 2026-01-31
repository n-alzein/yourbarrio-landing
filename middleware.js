// middleware.js
// Debug: check Network -> response headers `x-mw-hit` and `x-mw-path`.
// Visit `/health` and `/categories/test` to verify routing.
// If `/health` 404s, routes may not be registering or an upstream rewrite is interfering.
// If headers are missing, the request bypassed middleware or another middleware is active.
import { NextResponse } from "next/server";
import { clearSupabaseCookies, getSbCookieNamesFromRequest } from "@/lib/authCookies";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request) {
  const diagEnabled =
    process.env.NEXT_PUBLIC_AUTH_DIAG === "1" &&
    process.env.NODE_ENV !== "production";
  const pathname = request.nextUrl.pathname;
  const wrapNext = () => {
    const res = NextResponse.next();
    res.headers.set("x-mw-hit", "1");
    res.headers.set("x-mw-path", pathname);
    return res;
  };
  const wrapRedirect = (url) => {
    const res = NextResponse.redirect(url);
    res.headers.set("x-mw-hit", "1");
    res.headers.set("x-mw-path", pathname);
    return res;
  };
  const wrapJson = (data, init) => {
    const res = NextResponse.json(data, init);
    res.headers.set("x-mw-hit", "1");
    res.headers.set("x-mw-path", pathname);
    return res;
  };
  const wrapResponse = (res) => {
    res.headers.set("x-mw-hit", "1");
    res.headers.set("x-mw-path", pathname);
    return res;
  };
  const hasAuthCookie = getSbCookieNamesFromRequest(request).length > 0;
  if (diagEnabled) {
    console.warn("[AUTH_DIAG] mw:hit", { pathname, hasAuthCookie });
  }
  const isApiRoute = pathname.startsWith("/api/");
  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/public/")
  ) {
    return wrapNext();
  }
  const isPublicBusinessRoute =
    pathname === "/business" ||
    pathname === "/business/" ||
    pathname.startsWith("/business/about") ||
    pathname.startsWith("/business/login");
  if (isPublicBusinessRoute) {
    return wrapNext();
  }
  const isPublicCategoryRoute =
    pathname === "/categories" ||
    pathname === "/categories/" ||
    pathname.startsWith("/categories/");
  if (isPublicCategoryRoute) {
    if (diagEnabled) {
      console.warn("[AUTH_DIAG] public_route:allow", {
        pathname,
        type: "categories",
      });
    }
    return wrapNext();
  }

  if (!isApiRoute && !hasAuthCookie) {
    const redirectUrl = new URL("/?redirected=1", request.url);
    if (diagEnabled) {
      console.warn("[AUTH_DIAG] route_guard:redirect", {
        from: pathname,
        to: redirectUrl.pathname + redirectUrl.search,
        reason: "missing_auth_cookie",
      });
    }
    return wrapRedirect(redirectUrl);
  }

  if (pathname.startsWith("/api/auth/") || pathname === "/api/logout") {
    return wrapNext();
  }

  const response = await updateSession(request);
  const refreshError = response.headers.get("x-supabase-refresh-error");
  if (refreshError === "refresh_token_already_used") {
    if (isApiRoute) {
      const apiResponse = wrapJson(
        { error: "session_refresh_failed" },
        { status: 401 }
      );
      clearSupabaseCookies(apiResponse, request, {
        isProd: process.env.NODE_ENV === "production",
      });
      return wrapResponse(apiResponse);
    }

    const redirectUrl = new URL("/?redirected=1", request.url);
    const redirectResponse = wrapRedirect(redirectUrl);
    clearSupabaseCookies(redirectResponse, request, {
      isProd: process.env.NODE_ENV === "production",
    });
    return wrapResponse(redirectResponse);
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
  return wrapResponse(response);
}

export const config = {
  matcher: [
    "/api/:path*",
    "/customer/:path*",
    "/business/:path*",
    "/categories/:path*",
    "/health",
    "/categories/test",
  ],
};
