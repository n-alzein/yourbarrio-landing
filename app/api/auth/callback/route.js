"use server";

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getCookieBaseOptions } from "@/lib/authCookies";
import { PATHS } from "@/lib/auth/paths";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const isProd = process.env.NODE_ENV === "production";
  const cookieBaseOptions = getCookieBaseOptions({
    host: request.headers.get("host"),
    isProd,
  });

  const response = NextResponse.redirect(new URL(PATHS.public.root, request.url));
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
    if (code) {
      await supabase.auth.exchangeCodeForSession(code);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return response;
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role || user?.app_metadata?.role || null;

    const target =
      role === "business" ? PATHS.business.dashboard : PATHS.customer.home;
    response.headers.set("location", new URL(target, request.url).toString());
    return response;
  } catch (err) {
    return response;
  }
}
