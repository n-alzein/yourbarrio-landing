// middleware.js
import { NextResponse } from "next/server";
import { getCookieName } from "@/lib/supabaseClient";

export function middleware(request) {
  const diagEnabled =
    process.env.NEXT_PUBLIC_AUTH_DIAG === "1" &&
    process.env.NODE_ENV !== "production";
  const pathname = request.nextUrl.pathname;
  if (
    pathname.startsWith("/api/") ||
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
  const cookieName = getCookieName();
  const cookieNames = request.cookies.getAll().map((cookie) => cookie.name);
  const hasAuthCookie = cookieName
    ? cookieNames.some(
        (name) => name === cookieName || name.startsWith(`${cookieName}.`)
      )
    : false;

  if (!hasAuthCookie) {
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

  const response = NextResponse.next();
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
  matcher: ["/customer/:path*", "/business/:path*"],
};
