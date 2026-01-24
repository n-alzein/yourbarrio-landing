"use server";

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getCookieBaseOptions } from "@/lib/authCookies";
import { safeGetUser } from "@/lib/auth/safeGetUser";

export async function POST(request) {
  const debugAuth = process.env.DEBUG_AUTH === "true";
  const startedAt = Date.now();
  const requestUrl = request.url;
  const response = NextResponse.json({ ok: true }, { status: 200 });
  const isProd = process.env.NODE_ENV === "production";
  const debug = process.env.NEXT_PUBLIC_DEBUG_AUTH === "1";
  let body = {};
  const cookieBaseOptions = getCookieBaseOptions({
    host: request.headers.get("host"),
    isProd,
  });

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

    const { user, error } = await safeGetUser(supabase);

    if (debug) {
      console.log("[auth/refresh] user after refresh", Boolean(user), error);
    }

    response.headers.set("x-auth-refresh-user", user ? "1" : "0");
    response.headers.set("Cache-Control", "no-store");
    if (debugAuth) {
      console.log("[AUTH_DEBUG]", {
        label: "next.auth.refresh",
        method: request.method,
        url: requestUrl,
        timeoutMs: null,
        status: response.status,
        durationMs: Date.now() - startedAt,
        error: error?.message ?? null,
      });
    }
  } catch (err) {
    console.error("Supabase auth refresh failed", err);
    const fallback = NextResponse.json({ ok: false }, { status: 200 });
    fallback.headers.set("x-auth-refresh-user", "0");
    fallback.headers.set("Cache-Control", "no-store");
    if (debugAuth) {
      console.log("[AUTH_DEBUG]", {
        label: "next.auth.refresh",
        method: request.method,
        url: requestUrl,
        timeoutMs: null,
        status: fallback.status,
        durationMs: Date.now() - startedAt,
        error: err?.message ?? String(err),
      });
    }
    return fallback;
  }

  return response;
}
