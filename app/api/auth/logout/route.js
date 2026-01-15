"use server";

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

export async function GET(request) {
  const isProd = process.env.NODE_ENV === "production";
  const cookieDomain = getCookieDomain(request.headers.get("host"));

  const response = NextResponse.redirect(new URL("/", request.url));
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Clear-Site-Data", '"cookies", "storage"');
  response.headers.set("Vary", "Cookie");

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, {
              ...options,
              sameSite: "lax",
              secure: isProd,
              path: options?.path ?? "/",
              ...(cookieDomain ? { domain: cookieDomain } : {}),
            });
          });
        },
      },
    }
  );

  try {
    await supabase.auth.signOut({ scope: "global" });
  } catch {
    // Best-effort: still clear cookies below.
  }

  const sbCookieNames = request.cookies
    .getAll()
    .map((cookie) => cookie.name)
    .filter((name) => name.startsWith("sb-"));

  const uniqueNames = Array.from(new Set(sbCookieNames));
  uniqueNames.forEach((name) => {
    response.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
      secure: isProd,
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    });
  });

  return response;
}
