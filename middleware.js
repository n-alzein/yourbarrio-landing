// middleware.js
import { NextResponse } from "next/server";

export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/customer/:path*", "/business/:path*"],
};
