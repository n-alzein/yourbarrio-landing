import "server-only";

import { cookies } from "next/headers";
import { shouldUseSecureCookies } from "@/lib/http/cookiesSecurity";
import { getAdminDataClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient as getSupabaseServiceClient } from "@/lib/supabase/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export const IMPERSONATE_USER_COOKIE = "yb_impersonate_user_id";
export const IMPERSONATE_SESSION_COOKIE = "yb_impersonate_session_id";
export const IMPERSONATE_TARGET_ROLE_COOKIE = "yb_impersonate_target_role";

export type SupportModeCookieState = {
  sessionId: string | null;
  targetUserId: string | null;
  targetRole: "customer" | "business" | null;
  hasCookies: boolean;
};

export type SupportModeValidationResult =
  | {
      ok: true;
      actorUserId: string;
      sessionId: string;
      targetUserId: string;
      reason: "ok";
      hasCookies: true;
    }
  | {
      ok: false;
      reason:
        | "missing-cookies"
        | "missing-actor"
        | "missing-supabase-client"
        | "session-not-found"
        | "session-mismatch"
        | "session-inactive"
        | "session-ended"
        | "session-expired"
        | "query-error"
        | "exception";
      actorUserId: string | null;
      sessionId: string | null;
      targetUserId: string | null;
      hasCookies: boolean;
    };

type SupportModeInactive = {
  supportMode: false;
  actorUserId: string | null;
  effectiveUserId: null;
  sessionId: null;
  targetUserId: null;
  targetRole: null;
  homePath: "/admin/impersonation?error=missing-target-role";
  hasCookies: boolean;
  reason: SupportModeValidationResult["reason"];
};

type SupportModeActive = {
  supportMode: true;
  actorUserId: string;
  effectiveUserId: string;
  sessionId: string;
  targetUserId: string;
  targetRole: "customer" | "business" | null;
  homePath: string;
  hasCookies: true;
  reason: "ok";
};

export type EffectiveActorAndTarget = SupportModeActive | SupportModeInactive;

type SupportModeState =
  | {
      supportMode: true;
      effectiveUserId: string;
      sessionId: string;
      targetUserId: string;
    }
  | {
      supportMode: false;
      effectiveUserId: null;
      sessionId?: null;
      targetUserId?: null;
    };

export async function readSupportModeCookies(): Promise<SupportModeCookieState> {
  const cookieStore = await cookies();
  const sessionRaw = cookieStore.get(IMPERSONATE_SESSION_COOKIE)?.value || "";
  const targetRaw = cookieStore.get(IMPERSONATE_USER_COOKIE)?.value || "";
  const targetRoleRaw = (cookieStore.get(IMPERSONATE_TARGET_ROLE_COOKIE)?.value || "").trim();
  const sessionId = sessionRaw.trim() || null;
  const targetUserId = targetRaw.trim() || null;
  const targetRole =
    targetRoleRaw === "customer" || targetRoleRaw === "business" ? targetRoleRaw : null;
  const hasCookies = Boolean(sessionId || targetUserId || targetRole);
  return { sessionId, targetUserId, targetRole, hasCookies };
}

export async function clearSupportModeCookies() {
  let cookieStore = null;
  try {
    cookieStore = await cookies();
  } catch {
    return;
  }

  const secure = await shouldUseSecureCookies();
  const clearOptions = {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    maxAge: 0,
  };

  try {
    cookieStore?.set(IMPERSONATE_USER_COOKIE, "", clearOptions);
    cookieStore?.set(IMPERSONATE_SESSION_COOKIE, "", clearOptions);
    cookieStore?.set(IMPERSONATE_TARGET_ROLE_COOKIE, "", clearOptions);
  } catch {
    // Cookie mutation may be unavailable in some contexts.
  }
}

function getHomePathForRole(role: string | null): string {
  if (role === "business") return "/business/dashboard";
  if (role === "customer") return "/customer/home";
  return "/admin/impersonation?error=missing-target-role";
}

export async function validateSupportModeSession(
  actorUserId: string | null
): Promise<SupportModeValidationResult> {
  const diagEnabled = String(process.env.NEXT_PUBLIC_AUTH_DIAG || "") === "1";
  const cookieState = await readSupportModeCookies();

  const log = (payload: Record<string, unknown>) => {
    if (!diagEnabled) return;
    console.warn("[AUTH_DIAG] supportMode:validate", payload);
  };

  log({
    actorUserId,
    hasCookies: cookieState.hasCookies,
    sessionId: cookieState.sessionId,
    targetUserId: cookieState.targetUserId,
    reason: "start",
  });

  if (!cookieState.sessionId || !cookieState.targetUserId) {
    const result: SupportModeValidationResult = {
      ok: false,
      reason: "missing-cookies",
      actorUserId,
      sessionId: cookieState.sessionId,
      targetUserId: cookieState.targetUserId,
      hasCookies: cookieState.hasCookies,
    };
    log(result);
    return result;
  }

  if (!actorUserId) {
    const result: SupportModeValidationResult = {
      ok: false,
      reason: "missing-actor",
      actorUserId,
      sessionId: cookieState.sessionId,
      targetUserId: cookieState.targetUserId,
      hasCookies: cookieState.hasCookies,
    };
    log(result);
    return result;
  }

  try {
    const supabase = await getSupabaseServerClient();
    if (!supabase) {
      const result: SupportModeValidationResult = {
        ok: false,
        reason: "missing-supabase-client",
        actorUserId,
        sessionId: cookieState.sessionId,
        targetUserId: cookieState.targetUserId,
        hasCookies: cookieState.hasCookies,
      };
      log(result);
      return result;
    }

    const { data, error } = await supabase
      .from("admin_impersonation_sessions")
      .select("id, actor_user_id, target_user_id, active, ended_at, expires_at")
      .eq("id", cookieState.sessionId)
      .maybeSingle();

    if (error) {
      const result: SupportModeValidationResult = {
        ok: false,
        reason: "query-error",
        actorUserId,
        sessionId: cookieState.sessionId,
        targetUserId: cookieState.targetUserId,
        hasCookies: cookieState.hasCookies,
      };
      log({ ...result, error: error.message });
      return result;
    }

    if (!data) {
      const result: SupportModeValidationResult = {
        ok: false,
        reason: "session-not-found",
        actorUserId,
        sessionId: cookieState.sessionId,
        targetUserId: cookieState.targetUserId,
        hasCookies: cookieState.hasCookies,
      };
      log(result);
      return result;
    }

    if (
      data.actor_user_id !== actorUserId ||
      data.target_user_id !== cookieState.targetUserId
    ) {
      const result: SupportModeValidationResult = {
        ok: false,
        reason: "session-mismatch",
        actorUserId,
        sessionId: cookieState.sessionId,
        targetUserId: cookieState.targetUserId,
        hasCookies: cookieState.hasCookies,
      };
      log(result);
      return result;
    }

    if (data.active !== true) {
      const result: SupportModeValidationResult = {
        ok: false,
        reason: "session-inactive",
        actorUserId,
        sessionId: cookieState.sessionId,
        targetUserId: cookieState.targetUserId,
        hasCookies: cookieState.hasCookies,
      };
      log(result);
      return result;
    }

    if (data.ended_at) {
      const result: SupportModeValidationResult = {
        ok: false,
        reason: "session-ended",
        actorUserId,
        sessionId: cookieState.sessionId,
        targetUserId: cookieState.targetUserId,
        hasCookies: cookieState.hasCookies,
      };
      log(result);
      return result;
    }

    if (new Date(data.expires_at).getTime() <= Date.now()) {
      const result: SupportModeValidationResult = {
        ok: false,
        reason: "session-expired",
        actorUserId,
        sessionId: cookieState.sessionId,
        targetUserId: cookieState.targetUserId,
        hasCookies: cookieState.hasCookies,
      };
      log(result);
      return result;
    }

    const result: SupportModeValidationResult = {
      ok: true,
      reason: "ok",
      actorUserId,
      sessionId: cookieState.sessionId,
      targetUserId: cookieState.targetUserId,
      hasCookies: true,
    };
    log(result);
    return result;
  } catch {
    const result: SupportModeValidationResult = {
      ok: false,
      reason: "exception",
      actorUserId,
      sessionId: cookieState.sessionId,
      targetUserId: cookieState.targetUserId,
      hasCookies: cookieState.hasCookies,
    };
    log(result);
    return result;
  }
}

export async function getEffectiveActorAndTarget(
  actorUserId?: string | null
): Promise<EffectiveActorAndTarget> {
  const validation = await validateSupportModeSession(actorUserId || null);
  const cookieState = await readSupportModeCookies();

  if (!validation.ok) {
    return {
      supportMode: false,
      actorUserId: actorUserId || null,
      effectiveUserId: null,
      sessionId: null,
      targetUserId: null,
      targetRole: null,
      homePath: "/admin/impersonation?error=missing-target-role",
      hasCookies: validation.hasCookies,
      reason: validation.reason,
    };
  }

  let targetRole: "customer" | "business" | null = cookieState.targetRole;
  try {
    const serviceClient = getSupabaseServiceClient();
    const fallback = await getAdminDataClient();
    const roleClient = serviceClient ?? fallback.client;

    const { data: targetUser } = await roleClient
      .from("users")
      .select("role")
      .eq("id", validation.targetUserId)
      .maybeSingle();

    // In this app, missing/unknown role is treated as customer by default.
    // Only explicit "business" should route to business dashboards.
    if (targetUser) {
      const rawRole = targetUser.role || null;
      targetRole = rawRole === "business" ? "business" : "customer";
    }
  } catch {
    // Keep cookie-derived role fallback if present.
  }

  return {
    supportMode: true,
    actorUserId: validation.actorUserId,
    effectiveUserId: validation.targetUserId,
    sessionId: validation.sessionId,
    targetUserId: validation.targetUserId,
    targetRole,
    homePath: getHomePathForRole(targetRole),
    hasCookies: true,
    reason: "ok",
  };
}

export async function getSupportModeFromCookies(
  authUserId?: string | null
): Promise<SupportModeState> {
  const resolved = await getEffectiveActorAndTarget(authUserId);
  if (!resolved.supportMode) {
    return { supportMode: false, effectiveUserId: null };
  }
  return {
    supportMode: true,
    effectiveUserId: resolved.effectiveUserId,
    sessionId: resolved.sessionId,
    targetUserId: resolved.targetUserId,
  };
}

/*
SMOKE TEST CHECKLIST
1) Start support mode on a business target -> /business/dashboard loads with banner.
2) While viewing business target, open /customer/home -> redirect to /admin/impersonation?error=wrong-target.
3) Stop support mode via banner -> returns to /admin and impersonation cookies are cleared.
4) Admin logout clears impersonation cookies and signs out.
*/
