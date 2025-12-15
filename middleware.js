// middleware.js
import { NextResponse } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req) {
  // Forward request headers so Supabase helper can read cookies and set new ones
  const res = NextResponse.next({ request: { headers: req.headers } });
  const path = req.nextUrl.pathname;

  // Use explicit cookie name so browser + middleware stay in sync
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cookieName = supabaseUrl
    ? `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`
    : undefined;

  if (req.headers.get("x-supabase-callback") === "true") {
    return res;
  }

  const supabase = createMiddlewareClient(
    { req, res },
    cookieName ? { cookieOptions: { name: cookieName } } : undefined
  );
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const hasSession = Boolean(session);
  const isBusinessPublicPage =
    path === "/business" ||
    path === "/business/" ||
    path === "/business/about" ||
    path === "/business/about/";

  // Keep logged-in users off the public landing page
  if (path === "/" && hasSession) {
    let redirectTarget = "/customer/home";

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profile?.role === "business") {
      redirectTarget = "/business/dashboard";
    }

    return NextResponse.redirect(new URL(redirectTarget, req.url), {
      headers: res.headers,
    });
  }

  // Allow customer routes to handle auth client-side to avoid false redirects
  if (path.startsWith("/customer") && !hasSession) {
    return res;
  }

  // Allow business routes to render unauthenticated (handled client-side)
  if (path.startsWith("/business") && !hasSession) {
    return res;
  }

  return res;
}

export const config = {
  matcher: ["/", "/customer/:path*", "/business/:path*"],
};
