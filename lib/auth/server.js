/*
AUTH AUDIT REPORT
- Client auth calls: business-auth login/register pages, customer login/signup modals.
- Navbar auth decisions: CustomerNavbar/BusinessNavbar read AuthProvider state (now server-seeded).
- Middleware: no auth calls; matcher only targets protected groups.
- Server layouts/pages: auth/role enforcement now handled in group layouts.
- Flicker sources before refactor: client-side redirects on public landing, client navbars waiting on AuthProvider loading,
  AuthProvider polling/refresh logic, middleware auth checks on broad matcher.
*/
"use server";

import { cache } from "react";
import { redirect } from "next/navigation";
import {
  getProfileCached,
  getSupabaseServerClient,
  getUserCached,
} from "@/lib/supabaseServer";
import { PATHS } from "@/lib/auth/paths";
import { createServerTiming, logServerTiming, perfTimingEnabled } from "@/lib/serverTiming";

const getServerSupabase = cache(async () => {
  return getSupabaseServerClient();
});

export const getServerAuth = cache(async () => {
  const timing = createServerTiming("auth_");
  const t0 = timing.start();
  const supabase = await getServerSupabase();
  const supabaseMs = timing.end("supabase", t0);
  const t1 = timing.start();
  const { user } = await getUserCached(supabase);
  const userMs = timing.end("user", t1);

  if (!user) {
    if (await perfTimingEnabled()) {
      await logServerTiming("getServerAuth", {
        supabaseMs,
        userMs,
        totalMs: Math.round(supabaseMs + userMs),
      });
    }
    return { supabase, user: null };
  }

  if (await perfTimingEnabled()) {
    await logServerTiming("getServerAuth", {
      supabaseMs,
      userMs,
      totalMs: Math.round(supabaseMs + userMs),
    });
  }
  return { supabase, user: user ?? null };
});

export async function getProfile(userId, supabaseOverride) {
  if (!userId) return null;
  const timing = createServerTiming("profile_");
  const t0 = timing.start();
  const supabase = supabaseOverride ?? (await getServerSupabase());
  const supabaseMs = timing.end("supabase", t0);
  const t1 = timing.start();
  const profile = await getProfileCached(userId, supabase);
  const profileMs = timing.end("query", t1);
  if (await perfTimingEnabled()) {
    await logServerTiming("getProfile", {
      supabaseMs,
      profileMs,
      totalMs: Math.round(supabaseMs + profileMs),
    });
  }
  return profile;
}

export async function requireUser() {
  const timing = createServerTiming("requireUser_");
  const t0 = timing.start();
  const { supabase, user } = await getServerAuth();
  const authMs = timing.end("auth", t0);
  if (!user) {
    redirect(PATHS.auth.customerLogin);
  }
  if (await perfTimingEnabled()) {
    await logServerTiming("requireUser", { authMs });
  }
  return { supabase, user };
}

export async function requireRole(role) {
  const timing = createServerTiming("requireRole_");
  const t0 = timing.start();
  const { supabase, user } = await getServerAuth();
  const authMs = timing.end("auth", t0);

  if (!user) {
    const loginTarget =
      role === "business" ? PATHS.auth.businessLogin : PATHS.auth.customerLogin;
    redirect(loginTarget);
  }

  const t1 = timing.start();
  const profile = await getProfile(user.id, supabase);
  const profileMs = timing.end("profile", t1);
  const resolvedRole = profile?.role || user?.app_metadata?.role || null;

  if (role === "customer" && resolvedRole !== "customer") {
    redirect(PATHS.business.dashboard);
  }

  if (role === "business" && resolvedRole !== "business") {
    redirect(PATHS.customer.home);
  }

  if (await perfTimingEnabled()) {
    await logServerTiming("requireRole", {
      role,
      authMs,
      profileMs,
      totalMs: Math.round(authMs + profileMs),
    });
  }
  return { supabase, user, profile };
}

/*
VERIFICATION CHECKLIST
- Cold load /customer/home: CustomerNavbar renders immediately when authed; unauthenticated redirects server-side to /.
- Cold load /business/dashboard: BusinessNavbar renders immediately when authed; unauthenticated redirects server-side to /business-auth/login.
- Navigate between customer pages: no public navbar flashes.
- Open 2 tabs: no redirect loops.
- Auth request count stable (no refresh_token loops).
*/
