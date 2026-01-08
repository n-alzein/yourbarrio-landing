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

  let user = null;
  try {
    const {
      data,
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    user = data?.user ?? null;
  } catch (err) {
    log("getUser failed; clearing cookies", err?.message);
    clearSupabaseCookies();
    return res;
  }

  const hasSession = Boolean(user);
  const isCustomerPath = path.startsWith("/customer");
  const isBusinessProtectedPath =
    path.startsWith("/business/dashboard") ||
    path.startsWith("/business/listings") ||
    path.startsWith("/business/settings") ||
    path.startsWith("/business/onboarding");

  // Keep logged-in users off the public landing page
  if (path === "/" && hasSession) {
    let redirectTarget = "/customer/home";

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "business") {
      redirectTarget = "/business/dashboard";
    }

    return NextResponse.redirect(new URL(redirectTarget, req.url), {
      headers: res.headers,
    });
  }

  if (isCustomerPath && !hasSession) {
    return NextResponse.redirect(new URL("/", req.url), {
      headers: res.headers,
    });
  }

  if (isBusinessProtectedPath && !hasSession) {
    return NextResponse.redirect(new URL("/business-auth/login", req.url), {
      headers: res.headers,
    });
  }

  return res;
}

export const config = {
  matcher: ["/", "/customer/:path*", "/business/:path*"],
};
