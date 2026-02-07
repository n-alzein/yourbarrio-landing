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
import { getEffectiveActorAndTarget } from "@/lib/admin/supportMode";
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
  const requestPath = guardDiagEnabled ? await getRequestPath("/") : null;
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
        requestPath,
      });
    }
    redirect(`/signin?modal=signin&next=${encodeURIComponent(nextPath)}`);
  }

  const t1 = timing.start();
  const supportMode = await getEffectiveActorAndTarget(user.id);
  const effectiveUserId = supportMode.supportMode
    ? supportMode.effectiveUserId
    : user.id;
  const profile = await getProfile(effectiveUserId, supabase);
  const authUserProfile = supportMode.supportMode
    ? await getProfile(user.id, supabase)
    : profile;
  const profileMs = timing.end("profile", t1);
  const resolvedRole = supportMode.supportMode
    ? supportMode.targetRole
    : profile?.role || user?.app_metadata?.role || null;
  const authUserRole =
    authUserProfile?.role || user?.app_metadata?.role || null;
  const { data: adminRoleRows } = await supabase
    .from("admin_role_members")
    .select("role_key")
    .eq("user_id", user.id);
  const adminRoleKeys = Array.isArray(adminRoleRows)
    ? adminRoleRows.map((row) => row?.role_key).filter(Boolean)
    : [];
  const isAdmin = isAdminProfile(
    {
      role: authUserRole,
      is_internal: authUserProfile?.is_internal === true,
    },
    adminRoleKeys
  );

  if (guardDiagEnabled) {
    console.warn("[AUTH_GUARD_DIAG] requireRole:resolved", {
      guard: `requireRole(${role})`,
      userId: user?.id || null,
      email: user?.email || null,
        resolvedRole,
      isInternal: authUserProfile?.is_internal === true,
      isAdmin,
      supportMode: supportMode.supportMode,
      supportModeSessionId: supportMode.supportMode ? supportMode.sessionId : null,
      effectiveUserId,
      authUserId: user.id,
      requestPath,
    });
  }

  if (supportMode.supportMode) {
    const mismatch =
      (role === "customer" && resolvedRole !== "customer") ||
      (role === "business" && resolvedRole !== "business");
    if (mismatch) {
      if (guardDiagEnabled) {
        console.warn("[AUTH_GUARD_DIAG] requireRole:redirect", {
          guard: `requireRole(${role})`,
          reason: "wrong_support_mode_target",
          to: "/admin/impersonation?error=wrong-target",
          effectiveRole: resolvedRole,
          requestPath,
        });
      }
      redirect("/admin/impersonation?error=wrong-target");
    }
  }

  if (!supportMode.supportMode && role === "customer" && resolvedRole !== "customer") {
    if (isAdmin) {
      if (guardDiagEnabled) {
        console.warn("[AUTH_GUARD_DIAG] requireRole:redirect", {
          guard: `requireRole(${role})`,
          reason: "admin_precedence",
          to: "/admin",
          requestPath,
        });
      }
      redirect("/admin");
    }
    if (guardDiagEnabled) {
      console.warn("[AUTH_GUARD_DIAG] requireRole:redirect", {
        guard: `requireRole(${role})`,
        reason: "non_customer",
        to: PATHS.business.dashboard,
        requestPath,
      });
    }
    redirect(PATHS.business.dashboard);
  }

  if (!supportMode.supportMode && role === "business" && resolvedRole !== "business") {
    if (isAdmin) {
      if (guardDiagEnabled) {
        console.warn("[AUTH_GUARD_DIAG] requireRole:redirect", {
          guard: `requireRole(${role})`,
          reason: "admin_precedence",
          to: "/admin",
          requestPath,
        });
      }
      redirect("/admin");
    }
    if (guardDiagEnabled) {
      console.warn("[AUTH_GUARD_DIAG] requireRole:redirect", {
        guard: `requireRole(${role})`,
        reason: "non_business",
        to: PATHS.customer.home,
        requestPath,
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
  const effectiveUser = supportMode.supportMode
    ? { ...user, id: effectiveUserId }
    : user;
  return {
    supabase,
    user: effectiveUser,
    authUser: user,
    profile,
    effectiveProfile: profile,
    actorProfile: authUserProfile,
    actorUserId: user.id,
    effectiveRole: resolvedRole,
    supportHomePath: supportMode.supportMode ? supportMode.homePath : null,
    supportTargetRole: supportMode.supportMode ? supportMode.targetRole : null,
    supportMode: supportMode.supportMode,
    effectiveUserId,
  };
}

/*
VERIFICATION CHECKLIST
- Cold load /customer/home: CustomerNavbar renders immediately when authed; unauthenticated redirects server-side to /.
- Cold load /business/dashboard: BusinessNavbar renders immediately when authed; unauthenticated redirects server-side to /business-auth/login.
- Navigate between customer pages: no public navbar flashes.
- Open 2 tabs: no redirect loops.
- Auth request count stable (no refresh_token loops).
*/
