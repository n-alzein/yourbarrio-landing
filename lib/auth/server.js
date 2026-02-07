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
import { isAdminProfile } from "@/lib/auth/isAdmin";
import { PATHS } from "@/lib/auth/paths";
import { getRequestPath } from "@/lib/url/getRequestPath";
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
  const guardDiagEnabled =
    String(process.env.AUTH_GUARD_DIAG || "") === "1" ||
    String(process.env.NEXT_PUBLIC_AUTH_DIAG || "") === "1";
  const timing = createServerTiming("requireRole_");
  const t0 = timing.start();
  const { supabase, user } = await getServerAuth();
  const authMs = timing.end("auth", t0);

  if (!user) {
    const fallbackPath =
      role === "business" ? PATHS.business.dashboard : PATHS.customer.home;
    const nextPath = await getRequestPath(fallbackPath);
    if (guardDiagEnabled) {
      console.warn("[AUTH_GUARD_DIAG] requireRole:unauthenticated", {
        guard: `requireRole(${role})`,
        nextPath,
      });
    }
    redirect(`/signin?modal=signin&next=${encodeURIComponent(nextPath)}`);
  }

  const t1 = timing.start();
  const profile = await getProfile(user.id, supabase);
  const profileMs = timing.end("profile", t1);
  const resolvedRole = profile?.role || user?.app_metadata?.role || null;
  const isAdmin = isAdminProfile(
    {
      role: resolvedRole,
      is_internal: profile?.is_internal === true,
    },
    []
  );

  if (guardDiagEnabled) {
    console.warn("[AUTH_GUARD_DIAG] requireRole:resolved", {
      guard: `requireRole(${role})`,
      userId: user?.id || null,
      email: user?.email || null,
      resolvedRole,
      isInternal: profile?.is_internal === true,
      isAdmin,
    });
  }

  if (role === "customer" && resolvedRole !== "customer") {
    if (isAdmin) {
      if (guardDiagEnabled) {
        console.warn("[AUTH_GUARD_DIAG] requireRole:redirect", {
          guard: `requireRole(${role})`,
          reason: "admin_precedence",
          to: "/admin",
        });
      }
      redirect("/admin");
    }
    if (guardDiagEnabled) {
      console.warn("[AUTH_GUARD_DIAG] requireRole:redirect", {
        guard: `requireRole(${role})`,
        reason: "non_customer",
        to: PATHS.business.dashboard,
      });
    }
    redirect(PATHS.business.dashboard);
  }

  if (role === "business" && resolvedRole !== "business") {
    if (isAdmin) {
      if (guardDiagEnabled) {
        console.warn("[AUTH_GUARD_DIAG] requireRole:redirect", {
          guard: `requireRole(${role})`,
          reason: "admin_precedence",
          to: "/admin",
        });
      }
      redirect("/admin");
    }
    if (guardDiagEnabled) {
      console.warn("[AUTH_GUARD_DIAG] requireRole:redirect", {
        guard: `requireRole(${role})`,
        reason: "non_business",
        to: PATHS.customer.home,
      });
    }
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
