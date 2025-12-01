import { NextResponse } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const path = req.nextUrl.pathname;

  /* ---------------------------------------------------------
     1. PUBLIC BUSINESS AUTH ROUTES (always allowed)
  --------------------------------------------------------- */
  if (
    path.startsWith("/business-auth/login") ||
    path.startsWith("/business-auth/register")
  ) {
    return res;
  }

  /* ---------------------------------------------------------
     2. PROTECT REAL BUSINESS AREA ONLY:
        "/business/*" but NOT "/business-auth/*"
  --------------------------------------------------------- */
  if (
    path.startsWith("/business") &&    // business section
    !path.startsWith("/business-auth") // exclude business-auth
  ) {
    // Not logged in → send to business login
    if (!session) {
      return NextResponse.redirect(
        new URL("/business-auth/login", req.url)
      );
    }

    // Get role
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.user.id)
      .single();

    // If not business → redirect to customer home
    if (profile?.role !== "business") {
      return NextResponse.redirect(new URL("/customer/home", req.url));
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/business/:path*",        // business protected routes
    "/business-auth/login",    // public, bypass protection
    "/business-auth/register", // public, bypass protection
  ],
};
