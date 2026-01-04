// middleware.js
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req) {
  const debug = process.env.NEXT_PUBLIC_DEBUG_AUTH === "1";
  const isProd = process.env.NODE_ENV === "production";

  // Forward request headers so Supabase helper can read cookies and set new ones
  const res = NextResponse.next({ request: { headers: req.headers } });
  const path = req.nextUrl.pathname;

  const log = (message, ...args) => {
    if (debug) console.log(`[middleware] ${message}`, ...args);
  };

  log("executing for path", path);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            const baseOptions = {
              ...options,
              sameSite: "lax",
              secure: isProd,
              path: options?.path ?? "/",
            };
            res.cookies.set(name, value, baseOptions);
          });
        },
      },
    }
  );

  const clearSupabaseCookies = () => {
    const all = req.cookies.getAll();
    const targets = all
      .map((c) => c.name)
      .filter((name) => name.startsWith("sb-"));

    targets.forEach((name) => {
      res.cookies.set(name, "", {
        path: "/",
        maxAge: 0,
        sameSite: "lax",
        secure: isProd,
      });
    });

    if (targets.length && debug) {
      log("cleared invalid supabase cookies", targets);
    }
  };

  if (req.headers.get("x-supabase-callback") === "true") {
    return res;
  }

  let session = null;
  try {
    const {
      data: { session: s },
      error,
    } = await supabase.auth.getSession();
    if (error) throw error;
    session = s;
  } catch (err) {
    log("getSession failed; clearing cookies", err?.message);
    clearSupabaseCookies();
    return res;
  }

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
