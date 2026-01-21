"use server";

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  clearSupabaseCookies,
  getCookieBaseOptions,
  logSupabaseCookieDiagnostics,
} from "@/lib/authCookies";

export async function POST(request) {
  const isProd = process.env.NODE_ENV === "production";
  const debug = process.env.NEXT_PUBLIC_DEBUG_AUTH === "1";
  const response = NextResponse.json({ ok: true }, { status: 200 });
  const cookieBaseOptions = getCookieBaseOptions({
    host: request.headers.get("host"),
    isProd,
  });

  const log = (message, ...args) => {
    if (debug) console.log(`[auth/signout] ${message}`, ...args);
  };

  logSupabaseCookieDiagnostics({ req: request, debug, log });

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
    await supabase.auth.signOut({ scope: "global" });
  } catch {
    // Best-effort: still clear cookies below.
  }

  clearSupabaseCookies(response, request, { isProd, debug, log });
  response.headers.set("Cache-Control", "no-store");

  return response;
}
