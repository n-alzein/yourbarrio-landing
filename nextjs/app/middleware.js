import { NextResponse } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const path = req.nextUrl.pathname;

  // Only protect the /business pages
  if (path.startsWith("/business")) {

    // 🔥 If NOT logged in → ALWAYS send home (never send to login)
    if (!session) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Check user role
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.user.id)
      .single();

    // 🔥 If logged in but NOT a business → send home
    if (profile?.role !== "business") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ["/business/:path*"],
};
