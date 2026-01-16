"use server";

import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getCookieName } from "@/lib/supabaseClient";

const getCookieDomain = (host) => {
  if (!host) return undefined;
  const hostname = host.split(":")[0];
  if (hostname.endsWith("yourbarrio.com")) {
    return ".yourbarrio.com";
  }
  return undefined;
};

const clearCookieVariants = (response, name, isProd) => {
  const baseOptions = {
    path: "/",
    sameSite: "lax",
    secure: isProd,
    maxAge: 0,
    expires: new Date(0),
  };

  [".yourbarrio.com", "www.yourbarrio.com", undefined].forEach((domain) => {
    response.cookies.set(name, "", {
      ...baseOptions,
      ...(domain ? { domain } : {}),
    });
  });
};

export async function POST() {
  const cookieName = getCookieName();
  const isProd = process.env.NODE_ENV === "production";

  try {
    const cookieStore = await cookies();
    const host = (await headers()).get("host");
    const cookieDomain = getCookieDomain(host);
    const cookieBaseOptions = {
      sameSite: "lax",
      secure: isProd,
      path: "/",
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    };

    const res = NextResponse.json({ success: true });

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

    const cookieNames = cookieStore
      .getAll()
      .map((cookie) => cookie.name)
      .filter((name) => {
        if (name.startsWith("sb-")) return true;
        if (cookieName && name.startsWith(cookieName)) return true;
        return false;
      });

    if (cookieName) cookieNames.push(cookieName);
    const uniqueNames = Array.from(new Set(cookieNames));

    uniqueNames.forEach((name) => {
      // Explicitly clear auth cookies in case Supabase helper skips them
      clearCookieVariants(res, name, isProd);
    });

    return res;
  } catch (err) {
    console.error("API logout failed", err);
    return NextResponse.json({ success: false, error: "logout_failed" }, { status: 500 });
  }
}
