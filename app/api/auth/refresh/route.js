"use server";

import { NextResponse } from "next/server";
import {
  createSupabaseRouteHandlerClient,
  isRefreshTokenAlreadyUsedError,
} from "@/lib/supabaseServer";
import { clearSupabaseCookies } from "@/lib/authCookies";

export async function POST(request) {
  const debugAuth = process.env.DEBUG_AUTH === "true";
  const authDiagServer = process.env.AUTH_DIAG_SERVER === "1";
  const startedAt = Date.now();
  const requestUrl = request.url;
  const response = NextResponse.json({ ok: true }, { status: 200 });
  const debug = process.env.NEXT_PUBLIC_DEBUG_AUTH === "1";
  let body = {};

  try {
    body = await request.json();
  } catch (err) {
    // No body or invalid JSON; ignore for refresh flow
  }

  const accessToken = body?.access_token;
  const refreshToken = body?.refresh_token;

  const supabase = createSupabaseRouteHandlerClient(request, response);

  try {
    if (accessToken && refreshToken) {
      if (debug) {
        console.log("[auth/refresh] setSession with provided tokens");
      }

      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (authDiagServer) {
        console.info("[AUTH_DIAG_SERVER] refresh:set_session", {
          pathname: new URL(request.url).pathname,
          hadAccessToken: Boolean(accessToken),
          hadRefreshToken: Boolean(refreshToken),
          setSessionError: setSessionError?.message ?? null,
        });
      }
      if (setSessionError && isRefreshTokenAlreadyUsedError(setSessionError)) {
        const reset = NextResponse.json(
          { ok: false, error: "session_out_of_sync" },
          { status: 401 }
        );
        clearSupabaseCookies(reset, request, {
          isProd: process.env.NODE_ENV === "production",
        });
        console.warn("[AUTH_DIAG] refresh_token_already_used", {
          pathname: new URL(request.url).pathname,
          message: setSessionError?.message,
        });
        return reset;
      }
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error && isRefreshTokenAlreadyUsedError(error)) {
      const reset = NextResponse.json(
        { ok: false, error: "session_out_of_sync" },
        { status: 401 }
      );
      clearSupabaseCookies(reset, request, {
        isProd: process.env.NODE_ENV === "production",
      });
      console.warn("[AUTH_DIAG] refresh_token_already_used", {
        pathname: new URL(request.url).pathname,
        message: error?.message,
      });
      return reset;
    }

    if (debug) {
      console.log("[auth/refresh] user after refresh", Boolean(user), error);
    }
    if (authDiagServer) {
      console.info("[AUTH_DIAG_SERVER] refresh:result", {
        pathname: new URL(request.url).pathname,
        sessionExists: Boolean(session),
        sessionError: sessionError?.message ?? null,
        userExists: Boolean(user),
        userError: error?.message ?? null,
        cookieMutations: response.cookies.getAll().map((cookie) => cookie.name),
      });
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
