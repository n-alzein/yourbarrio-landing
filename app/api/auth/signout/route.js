"use server";

import { NextResponse } from "next/server";
import {
  clearSupabaseCookies,
  logSupabaseCookieDiagnostics,
} from "@/lib/authCookies";
import { createSupabaseRouteHandlerClient } from "@/lib/supabaseServer";

export async function POST(request) {
  const isProd = process.env.NODE_ENV === "production";
  const debug = process.env.NEXT_PUBLIC_DEBUG_AUTH === "1";
  const response = NextResponse.json({ ok: true }, { status: 200 });

  const log = (message, ...args) => {
    if (debug) console.log(`[auth/signout] ${message}`, ...args);
  };

  logSupabaseCookieDiagnostics({ req: request, debug, log });

  const supabase = createSupabaseRouteHandlerClient(request, response);

  try {
    await supabase.auth.signOut({ scope: "global" });
  } catch {
    // Best-effort: still clear cookies below.
  }

  clearSupabaseCookies(response, request, { isProd, debug, log });
  response.headers.set("Cache-Control", "no-store");

  return response;
}
