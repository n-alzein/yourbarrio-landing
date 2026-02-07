// middleware.js
// Debug: check Network -> response headers `x-mw-hit` and `x-mw-path`.
// Visit `/health` and `/categories/test` to verify routing.
// If `/health` 404s, routes may not be registering or an upstream rewrite is interfering.
// If headers are missing, the request bypassed middleware or another middleware is active.
import { NextResponse } from "next/server";
import { clearSupabaseCookies, getSbCookieNamesFromRequest } from "@/lib/authCookies";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request) {
  const mwStart = performance.now();
  const diagEnabled =
    process.env.AUTH_GUARD_DIAG === "1" ||
    process.env.NEXT_PUBLIC_AUTH_DIAG === "1";
  const pathname = request.nextUrl.pathname;
  const perfEnabled =
    request.nextUrl.searchParams?.get("perf") === "1" ||
    process.env.NEXT_PUBLIC_PERF_DEBUG === "1";
  const requestHeaders = new Headers(request.headers);
  if (perfEnabled) {
    requestHeaders.set("x-perf", "1");
    requestHeaders.set("x-perf-path", pathname);
  }
  const timing = [];
  const markTiming = (name, startAt) => {
    if (!perfEnabled) return;
    const dur = performance.now() - startAt;
    timing.push(`${name};dur=${Math.round(dur)}`);
  };
  const wrapPerfHeaders = (res) => {
    if (perfEnabled) {
      if (timing.length) {
        res.headers.set("Server-Timing", timing.join(", "));
      } else {
        res.headers.set("Server-Timing", `middleware;dur=${Math.round(performance.now() - mwStart)}`);
      }
      res.headers.set("x-perf", "1");
      res.headers.set("x-perf-path", pathname);
      try {
        res.cookies.set("yb-perf", "1", { path: "/", maxAge: 600 });
      } catch {
        // best effort
      }
    }
    return res;
  };
  const wrapNext = () => {
    const t0 = performance.now();
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("x-mw-hit", "1");
    res.headers.set("x-mw-path", pathname);
    markTiming("mw_next", t0);
    return wrapPerfHeaders(res);
  };
  const wrapRedirect = (url) => {
    const t0 = performance.now();
    const res = NextResponse.redirect(url);
    res.headers.set("x-mw-hit", "1");
    res.headers.set("x-mw-path", pathname);
    markTiming("mw_redirect", t0);
    return wrapPerfHeaders(res);
  };
  const wrapJson = (data, init) => {
    const t0 = performance.now();
    const res = NextResponse.json(data, init);
    res.headers.set("x-mw-hit", "1");
    res.headers.set("x-mw-path", pathname);
    markTiming("mw_json", t0);
    return wrapPerfHeaders(res);
  };
  const wrapResponse = (res) => {
    res.headers.set("x-mw-hit", "1");
    res.headers.set("x-mw-path", pathname);
    return wrapPerfHeaders(res);
  };
  const cookieStart = performance.now();
  const hasAuthCookie = getSbCookieNamesFromRequest(request).length > 0;
  markTiming("mw_cookies", cookieStart);
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

  const sessionStart = performance.now();
  const response = await updateSession(request, requestHeaders);
  markTiming("mw_session", sessionStart);
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
