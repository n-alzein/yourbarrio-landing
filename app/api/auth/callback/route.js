"use server";

import { NextResponse } from "next/server";
import { PATHS } from "@/lib/auth/paths";
import {
  createSupabaseRouteHandlerClient,
  getUserCached,
} from "@/lib/supabaseServer";
import { resolvePostLoginTarget } from "@/lib/auth/redirects";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const authDiagEnabled = process.env.NEXT_PUBLIC_AUTH_DIAG === "1";

  const response = NextResponse.redirect(new URL(PATHS.public.root, request.url));
  const supabase = createSupabaseRouteHandlerClient(request, response);

  try {
    if (code) {
      if (authDiagEnabled) {
        console.log("[AUTH_DIAG]", {
          timestamp: new Date().toISOString(),
          pathname: requestUrl.pathname,
          label: "auth:exchangeCodeForSession",
          stack: new Error().stack,
        });
      }
      await supabase.auth.exchangeCodeForSession(code);
    }

    const { user } = await getUserCached(supabase);

    if (!user) {
      return response;
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role || user?.app_metadata?.role || null;
    const nextParam = ["next", "returnUrl", "callbackUrl"]
      .map((key) => requestUrl.searchParams.get(key))
      .find(Boolean);
    const target = resolvePostLoginTarget({
      role,
      next: nextParam,
      origin: requestUrl.origin,
    });
    response.headers.set("location", new URL(target, request.url).toString());
    return response;
  } catch (err) {
    return response;
  }
}
