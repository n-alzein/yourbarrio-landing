"use server";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { getCookieName } from "@/lib/supabaseClient";

export async function POST() {
  const cookieName = getCookieName();

  try {
    const cookieStore = await cookies();

    const supabase = createRouteHandlerClient(
      { cookies: () => cookieStore },
      cookieName ? { cookieOptions: { name: cookieName } } : undefined
    );

    await supabase.auth.signOut();

    const res = NextResponse.json({ success: true });

    if (cookieName) {
      // Explicitly clear auth cookie in case Supabase helper skips it
      res.cookies.set(cookieName, "", {
        path: "/",
        maxAge: 0,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }

    return res;
  } catch (err) {
    console.error("API logout failed", err);
    return NextResponse.json({ success: false, error: "logout_failed" }, { status: 500 });
  }
}
