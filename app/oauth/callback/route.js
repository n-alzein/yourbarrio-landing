"use server";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { getCookieName } from "@/lib/supabaseClient";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const cookieName = getCookieName();

  // Redirect back to login if no code is present
  if (!code) {
    requestUrl.pathname = "/";
    requestUrl.searchParams.set("modal", "customer-login");
    requestUrl.searchParams.set("oauth", "missing-code");
    return NextResponse.redirect(requestUrl);
  }

  // Prepare Supabase client bound to the current cookie jar
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient(
    { cookies: () => cookieStore },
    cookieName ? { cookieOptions: { name: cookieName } } : undefined
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

  return NextResponse.redirect(requestUrl);
}
