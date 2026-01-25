"use server";

import { NextResponse } from "next/server";
import {
  clearSupabaseCookies,
  logSupabaseCookieDiagnostics,
} from "@/lib/authCookies";
import { createSupabaseRouteHandlerClient } from "@/lib/supabaseServer";

export async function GET(request) {
  const isProd = process.env.NODE_ENV === "production";
  const debug = process.env.NEXT_PUBLIC_DEBUG_AUTH === "1";
  const authDiagEnabled = process.env.NEXT_PUBLIC_AUTH_DIAG === "1";

  const nextUrl = new URL(request.url);
  const redirectParam = nextUrl.searchParams.get("redirect") || "/";
  const safeRedirect = redirectParam.startsWith("/") ? redirectParam : "/";
  const response = NextResponse.redirect(new URL(safeRedirect, request.url), 303);
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

  const supabase = createSupabaseRouteHandlerClient(request, response);

  try {
    await supabase.auth.signOut({ scope: "global" });
  } catch {
    // Best-effort: still clear cookies below.
  }

  clearSupabaseCookies(response, request, { isProd, debug, log });

  return response;
}
