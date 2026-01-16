"use server";

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const getCookieDomain = (host) => {
  if (!host) return undefined;
  const hostname = host.split(":")[0];
  if (hostname.endsWith("yourbarrio.com")) {
    return ".yourbarrio.com";
  }
  return undefined;
};

export async function POST(request) {
  const response = NextResponse.json({ ok: true }, { status: 200 });
  const isProd = process.env.NODE_ENV === "production";
  const debug = process.env.NEXT_PUBLIC_DEBUG_AUTH === "1";
  let body = {};
  const cookieDomain = getCookieDomain(request.headers.get("host"));
  const cookieBaseOptions = {
    sameSite: "lax",
    secure: isProd,
    path: "/",
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  };

  try {
    body = await request.json();
  } catch (err) {
    // No body or invalid JSON; ignore for refresh flow
  }

  const accessToken = body?.access_token;
  const refreshToken = body?.refresh_token;

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
              ...cookieBaseOptions,
            });
          });
        },
      },
    }
  );

  try {
    if (accessToken && refreshToken) {
      if (debug) {
        console.log("[auth/refresh] setSession with provided tokens");
      }

      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (debug) {
      console.log("[auth/refresh] user after refresh", Boolean(user), error);
    }

    response.headers.set("x-auth-refresh-user", user ? "1" : "0");
    response.headers.set("Cache-Control", "no-store");
  } catch (err) {
    console.error("Supabase auth refresh failed", err);
    const fallback = NextResponse.json({ ok: false }, { status: 200 });
    fallback.headers.set("x-auth-refresh-user", "0");
    fallback.headers.set("Cache-Control", "no-store");
    return fallback;
  }

  return response;
}
