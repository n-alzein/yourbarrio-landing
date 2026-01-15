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

  if (hostname.endsWith("yourbarrio.com")) {
    return ".yourbarrio.com";
  }

  return undefined;
};

const applyCookies = (fromRes, toRes, baseOptions, log) => {
  const cookies = fromRes.cookies.getAll();
  cookies.forEach((cookie) => {
    const { name, value, ...options } = cookie;
    toRes.cookies.set(name, value, {
      ...options,
      ...baseOptions,
    });
  });

  if (log && cookies.length) {
    log("merged cookies into response", cookies.map((c) => c.name));
  }
};

export async function middleware(req) {
  const debug = process.env.NEXT_PUBLIC_DEBUG_AUTH === "1";
  const isProd = process.env.NODE_ENV === "production";
  const cookieDomain = getCookieDomain(req.headers.get("host"));
  const cookieBaseOptions = {
    sameSite: "lax",
    secure: isProd,
    path: "/",
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  };

  // Use a single base response for Supabase to mutate; copy its cookies
  // into any redirect/rewrite response to avoid dropping Set-Cookie.
  const response = NextResponse.next({ request: { headers: req.headers } });
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
            response.cookies.set(name, value, {
              ...options,
              ...cookieBaseOptions,
              path: options?.path ?? cookieBaseOptions.path,
            });
          });
        },
      },
    }
  );

  const clearSupabaseCookies = () => {
    const targets = req.cookies
      .getAll()
      .map((c) => c.name)
      .filter((name) => name.startsWith("sb-"));

    targets.forEach((name) => {
      response.cookies.set(name, "", {
        ...cookieBaseOptions,
        maxAge: 0,
      });
    });

    if (targets.length && debug) {
      log("cleared invalid supabase cookies", targets);
    }
  };

  if (req.headers.get("x-supabase-callback") === "true") {
    return response;
  }

  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    user = data?.user ?? null;
  } catch (err) {
    log("getUser failed; clearing cookies", err?.message);
    clearSupabaseCookies();
    if (debug) {
      const sbCookies = req.cookies
        .getAll()
        .map((c) => c.name)
        .filter((name) => name.startsWith("sb-"));
      log("session snapshot", { path, hasSession: false, sbCookies });
    }
    return response;
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

  if (debug) {
    const sbCookies = req.cookies
      .getAll()
      .map((c) => c.name)
      .filter((name) => name.startsWith("sb-"));
    log("session snapshot", { path, hasSession, sbCookies });
  }

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

    const redirectRes = NextResponse.redirect(new URL(redirectTarget, req.url));
    applyCookies(response, redirectRes, cookieBaseOptions, debug ? log : null);
    return redirectRes;
  }

  if (isCustomerPath && !hasSession) {
    const redirectRes = NextResponse.redirect(new URL("/", req.url));
    applyCookies(response, redirectRes, cookieBaseOptions, debug ? log : null);
    return redirectRes;
  }

  if (isBusinessProtectedPath && !hasSession) {
    const redirectRes = NextResponse.redirect(
      new URL("/business-auth/login", req.url)
    );
    applyCookies(response, redirectRes, cookieBaseOptions, debug ? log : null);
    return redirectRes;
  }

  if (isPublicBusinessProfilePath && hasSession) {
    const resolvedRole = await resolveRole();
    if (resolvedRole === "customer") {
      const rewritten = req.nextUrl.clone();
      rewritten.pathname = `/customer${path}`;
      const rewriteRes = NextResponse.rewrite(rewritten);
      applyCookies(response, rewriteRes, cookieBaseOptions, debug ? log : null);
      return rewriteRes;
    }
  }

  return response;
}

export const config = {
  matcher: ["/", "/customer/:path*", "/business/:path*", "/b/:path*"],
};
