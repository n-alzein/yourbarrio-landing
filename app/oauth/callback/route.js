"use server";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getCookieName } from "@/lib/supabaseClient";
import { getCookieBaseOptions } from "@/lib/authCookies";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const cookieName = getCookieName();
  const pendingCookies = [];
  const isProd = process.env.NODE_ENV === "production";
  const cookieBaseOptions = getCookieBaseOptions({
    host: request.headers.get("host"),
    isProd,
  });

  // Redirect back to login if no code is present
  if (!code) {
    requestUrl.pathname = "/";
    requestUrl.searchParams.set("modal", "customer-login");
    requestUrl.searchParams.set("oauth", "missing-code");
    return NextResponse.redirect(requestUrl);
  }

  // Prepare Supabase client bound to the current cookie jar
  const cookieStore = await cookies();
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
          cookiesToSet.forEach((cookie) => pendingCookies.push(cookie));
        },
      },
    }
  );

  // Exchange the code for a session (sets auth cookies)
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("OAuth exchange failed", error);
    requestUrl.pathname = "/";
    requestUrl.searchParams.set("modal", "customer-login");
    requestUrl.searchParams.set("oauth", "failed");
    return NextResponse.redirect(requestUrl);
  }

  const user = data.session?.user;
  if (!user) {
    requestUrl.pathname = "/";
    requestUrl.searchParams.set("modal", "customer-login");
    requestUrl.searchParams.set("oauth", "no-user");
    return NextResponse.redirect(requestUrl);
  }

  // Derive profile fields
  const fullName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    "";

  const avatar = user.user_metadata?.avatar_url || null;

  // Ensure user row exists + read role
  const { data: existing } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!existing) {
    await supabase.from("users").insert({
      id: user.id,
      email: user.email,
      role: "customer",
      full_name: fullName,
      profile_photo_url: avatar,
      created_at: new Date().toISOString(),
    });
  }

  const role = existing?.role ?? "customer";
  const target =
    role === "business" ? "/business/dashboard" : "/customer/home";

  requestUrl.pathname = target;
  requestUrl.search = ""; // clear oauth params

  const response = NextResponse.redirect(requestUrl);
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, {
      ...options,
      ...cookieBaseOptions,
    });
  });

  return response;
}
