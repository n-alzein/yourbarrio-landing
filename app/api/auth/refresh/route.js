"use server";

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function POST(request) {
  const response = new NextResponse(null, { status: 204 });
  const isProd = process.env.NODE_ENV === "production";
  const debug = process.env.NEXT_PUBLIC_DEBUG_AUTH === "1";
  let body = {};

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
            const baseOptions = {
              ...options,
              sameSite: "lax",
              secure: isProd,
              path: options?.path ?? "/",
            };

            response.cookies.set(name, value, baseOptions);
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
  } catch (err) {
    console.error("Supabase auth refresh failed", err);
    return new NextResponse(null, { status: 200 });
  }

  return response;
}
