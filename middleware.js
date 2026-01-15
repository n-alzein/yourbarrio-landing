// middleware.js
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const getCookieDomain = (host) => {
  if (!host) return undefined;
  const hostname = host.split(":")[0];
  if (
    hostname === "localhost" ||
    hostname.startsWith("127.") ||
    hostname.endsWith(".local")
  ) {
    return undefined;
  }
  const root = hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  return root ? `.${root}` : undefined;
};

export async function middleware(req) {
  const debug = process.env.NEXT_PUBLIC_DEBUG_AUTH === "1";
  const isProd = process.env.NODE_ENV === "production";
  const cookieDomain = getCookieDomain(req.headers.get("host"));

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
              ...(cookieDomain ? { domain: cookieDomain } : {}),
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
        ...(cookieDomain ? { domain: cookieDomain } : {}),
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
  const isPublicBusinessProfilePath = path.startsWith("/b/");
  let role = null;

  async function resolveRole() {
    if (!hasSession || role) return role;
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = profile?.role ?? null;
    return role;
  }

  // Keep logged-in users off the public landing page
  if (path === "/" && hasSession) {
    let redirectTarget = "/customer/home";

    const resolvedRole = await resolveRole();

    if (resolvedRole === "business") {
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
    return NextResponse.redirect(new URL("/business/login", req.url), {
      headers: res.headers,
    });
  }

  if (isPublicBusinessProfilePath && hasSession) {
    const resolvedRole = await resolveRole();
    if (resolvedRole === "customer") {
      const rewritten = req.nextUrl.clone();
      rewritten.pathname = `/customer${path}`;
      return NextResponse.rewrite(rewritten);
    }
  }

  return res;
}

export const config = {
  matcher: ["/", "/customer/:path*", "/business/:path*", "/b/:path*"],
};
