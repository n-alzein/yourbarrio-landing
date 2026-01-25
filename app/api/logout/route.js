"use server";

import { NextResponse } from "next/server";
import { getCookieName } from "@/lib/supabase/browser";
import {
  clearSupabaseCookies,
  logSupabaseCookieDiagnostics,
} from "@/lib/authCookies";
import { createSupabaseRouteHandlerClient } from "@/lib/supabaseServer";

export async function POST(request) {
  const cookieName = getCookieName();
  const isProd = process.env.NODE_ENV === "production";
  const debug = process.env.NEXT_PUBLIC_DEBUG_AUTH === "1";

  try {
    const res = NextResponse.json({ success: true });
    const log = (message, ...args) => {
      if (debug) console.log(`[api/logout] ${message}`, ...args);
    };
    logSupabaseCookieDiagnostics({
      req: request,
      debug,
      log,
    });

    const supabase = createSupabaseRouteHandlerClient(request, res, {
      cookieName,
    });

    await supabase.auth.signOut();

    clearSupabaseCookies(res, request, { isProd, debug, log });
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
