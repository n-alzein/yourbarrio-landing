"use server";

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  clearSupabaseCookies,
  getCookieBaseOptions,
  logSupabaseCookieDiagnostics,
} from "@/lib/authCookies";

export async function GET(request) {
  const isProd = process.env.NODE_ENV === "production";
  const debug = process.env.NEXT_PUBLIC_DEBUG_AUTH === "1";
  const authDiagEnabled = process.env.NEXT_PUBLIC_AUTH_DIAG === "1";
  const cookieBaseOptions = getCookieBaseOptions({
    host: request.headers.get("host"),
    isProd,
  });

  const response = NextResponse.redirect(new URL("/", request.url), 303);
  if (authDiagEnabled) {
    console.warn("[AUTH_DIAG] logout:redirect", {
      pathname: new URL(request.url).pathname,
      status: response.status,
      location: response.headers.get("location"),
    });
  }
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Clear-Site-Data", '"cookies", "storage"');
  response.headers.set("Vary", "Cookie");

  const log = (message, ...args) => {
    if (debug) console.log(`[auth/logout] ${message}`, ...args);
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

  return response;
}
