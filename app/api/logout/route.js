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
      res.cookies.set(name, "", {
        path: "/",
        maxAge: 0,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    });

    return res;
  } catch (err) {
    console.error("API logout failed", err);
    return NextResponse.json({ success: false, error: "logout_failed" }, { status: 500 });
  }
}
