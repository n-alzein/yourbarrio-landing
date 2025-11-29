import { NextResponse } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // 1️⃣ Get the user session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const path = req.nextUrl.pathname;

  // 2️⃣ Protect /business/* — requires logged-in + role === "business"
  if (path.startsWith("/business")) {
    if (!session) {
      // Redirect to login if not logged in
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // Fetch profile role
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profile?.role !== "business") {
      // Not a business user → send to customer home (or homepage)
      return NextResponse.redirect(new URL("/customer/home", req.url));
    }
  }

  return res;
}

// 👇 Define which routes this middleware runs on
export const config = {
  matcher: ["/business/:path*"], // All business routes
};
