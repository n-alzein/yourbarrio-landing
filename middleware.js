// middleware.js
import { NextResponse } from "next/server";

export function middleware(request) {
  const response = NextResponse.next();
  const diagEnabled =
    process.env.NEXT_PUBLIC_AUTH_DIAG === "1" &&
    process.env.NODE_ENV !== "production";
  if (diagEnabled) {
    const hasRsc =
      request.headers.get("RSC") === "1" ||
      request.headers.has("next-router-state-tree");
    if (hasRsc) {
      console.warn("[AUTH_DIAG] rsc:request", {
        pathname: request.nextUrl.pathname,
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
