"use server";

import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getCookieName } from "@/lib/supabase/browser";
import {
  clearSupabaseCookies,
  getCookieBaseOptions,
  logSupabaseCookieDiagnostics,
} from "@/lib/authCookies";

export async function POST() {
  const cookieName = getCookieName();
  const isProd = process.env.NODE_ENV === "production";
  const debug = process.env.NEXT_PUBLIC_DEBUG_AUTH === "1";

  try {
    const cookieStore = await cookies();
    const host = (await headers()).get("host");
    const cookieBaseOptions = getCookieBaseOptions({ host, isProd });

    const res = NextResponse.json({ success: true });
    const log = (message, ...args) => {
      if (debug) console.log(`[api/logout] ${message}`, ...args);
    };
    logSupabaseCookieDiagnostics({
      req: { cookies: cookieStore, headers: { get: () => null } },
      debug,
      log,
    });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookieOptions: cookieName ? { name: cookieName } : undefined,
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              res.cookies.set(name, value, {
                ...options,
                ...cookieBaseOptions,
              });
            });
          },
        },
      }
    );

    await supabase.auth.signOut();

    clearSupabaseCookies(res, { cookies: cookieStore }, { isProd, debug, log });
    if (cookieName) {
      res.cookies.set(cookieName, "", {
        path: "/",
        sameSite: "lax",
        secure: isProd,
        maxAge: 0,
        expires: new Date(0),
      });
    }

    return res;
  } catch (err) {
    console.error("API logout failed", err);
    return NextResponse.json({ success: false, error: "logout_failed" }, { status: 500 });
  }
}
