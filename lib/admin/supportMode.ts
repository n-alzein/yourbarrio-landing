import "server-only";

import { cookies } from "next/headers";
import { shouldUseSecureCookies } from "@/lib/http/cookiesSecurity";
import { getSupabaseServerAuthedClient } from "@/lib/supabaseServer";

export const IMPERSONATE_USER_COOKIE = "yb_impersonate_user_id";
export const IMPERSONATE_SESSION_COOKIE = "yb_impersonate_session_id";
export const IMPERSONATE_TARGET_ROLE_COOKIE = "yb_impersonate_target_role";

export type SupportModeCookieState = {
  sessionId: string | null;
  targetUserId: string | null;
  targetRole: "customer" | "business" | null;
  hasCookies: boolean;
};

type SessionRole = "customer" | "business";

type SessionRpcRow = {
  session_id: string;
  actor_user_id: string;
  target_user_id: string;
  target_role: SessionRole;
  expires_at: string;
  is_active: boolean;
};

export type SupportModeValidationResult =
  | {
      ok: true;
      actorUserId: string;
      sessionId: string;
      targetUserId: string;
      targetRole: SessionRole;
      reason: "ok";
      hasCookies: true;
    }
  | {
      ok: false;
      reason:
        | "missing-cookies"
        | "missing-actor"
        | "wrong-target"
        | "invalid-session"
        | "schema-not-deployed"
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
  cookieTargetRole: "customer" | "business" | null;
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
  targetRole: SessionRole;
  cookieTargetRole: "customer" | "business" | null;
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

function isMissingTargetRoleSchemaError(error: { code?: string | null; message?: string | null } | null) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return code === "42703" && message.includes("target_role");
}

export async function validateSupportModeSession(
  actorUserId: string | null
): Promise<SupportModeValidationResult> {
  const diagEnabled = String(process.env.NEXT_PUBLIC_AUTH_DIAG || "") === "1";
  const cookieState = await readSupportModeCookies();
  const cookieJar = await cookies();
  const rawSessionId = cookieJar.get(IMPERSONATE_SESSION_COOKIE)?.value || null;
  const rawTargetUserId = cookieJar.get(IMPERSONATE_USER_COOKIE)?.value || null;
  const rawTargetRole = cookieJar.get(IMPERSONATE_TARGET_ROLE_COOKIE)?.value || null;
  if (diagEnabled) {
    console.warn("[support-mode][validate][cookie-debug]", {
      rawSessionId,
      rawTargetUserId,
      rawTargetRole,
      sessionId: cookieState.sessionId,
      targetUserId: cookieState.targetUserId,
      targetRole: cookieState.targetRole,
      hasCookies: cookieState.hasCookies,
    });
  }
  if (diagEnabled) {
    console.warn("[support-mode][validate][cookie-snapshot]", {
      sessionId: cookieState.sessionId,
      targetUserId: cookieState.targetUserId,
      hasCookies: cookieState.hasCookies,
    });
  }

  const log = (payload: Record<string, unknown>) => {
    if (!diagEnabled) return;
    console.warn("[AUTH_DIAG] supportMode:validate", payload);
  };
  const isUuid = (value: string | null) =>
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

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
    const supabase = await getSupabaseServerAuthedClient();
    if (!supabase) {
      const result: SupportModeValidationResult = {
        ok: false,
        reason: "query-error",
        actorUserId,
        sessionId: cookieState.sessionId,
        targetUserId: cookieState.targetUserId,
        hasCookies: cookieState.hasCookies,
      };
      log({ ...result, clientType: "authed" });
      return result;
    }
    log({ reason: "rpc-client", clientType: "authed", actorUserId });

    const { data, error } = await supabase.rpc("get_impersonation_session", {
      p_session_id: cookieState.sessionId,
    });

    if (error) {
      if (isMissingTargetRoleSchemaError(error)) {
        const result: SupportModeValidationResult = {
          ok: false,
          reason: "schema-not-deployed",
          actorUserId,
          sessionId: cookieState.sessionId,
          targetUserId: cookieState.targetUserId,
          hasCookies: cookieState.hasCookies,
        };
        log({
          ...result,
          clientType: "authed",
          error: error.message,
          code: error.code,
        });
        return result;
      }
      const result: SupportModeValidationResult = {
        ok: false,
        reason: "query-error",
        actorUserId,
        sessionId: cookieState.sessionId,
        targetUserId: cookieState.targetUserId,
        hasCookies: cookieState.hasCookies,
      };
      log({
        ...result,
        clientType: "authed",
        error: error.message,
        code: error.code,
      });
      return result;
    }

    const row = (Array.isArray(data) ? data[0] : data) as SessionRpcRow | null;
    const rpcRowCount = Array.isArray(data) ? data.length : row ? 1 : 0;
    const validRole = row?.target_role === "customer" || row?.target_role === "business";
    const norm = (v: unknown) =>
      String(v ?? "")
        .trim()
        .replace(/^"+|"+$/g, "")
        .toLowerCase();
    const cookieTargetNorm = norm(cookieState.targetUserId);
    const dbTargetNorm = norm(row?.target_user_id);
    const matchesCookieTarget =
      cookieTargetNorm !== "" && dbTargetNorm !== "" && cookieTargetNorm === dbTargetNorm;

    if (!row) {
      log({
        reason: "invalid-session-empty",
        clientType: "authed",
        sessionId: cookieState.sessionId,
        actorUserId,
        cookieTargetUserId: cookieState.targetUserId,
        sessionIdIsUuid: isUuid(cookieState.sessionId),
        rpcRowCount,
      });
    }

    if (row && cookieState.targetUserId && row.target_user_id && !matchesCookieTarget) {
      const result: SupportModeValidationResult = {
        ok: false,
        reason: "wrong-target",
        actorUserId,
        sessionId: cookieState.sessionId,
        targetUserId: cookieState.targetUserId,
        hasCookies: cookieState.hasCookies,
      };
      log({
        ...result,
        clientType: "authed",
        sessionId: row.session_id,
        cookieTargetUserId: cookieState.targetUserId,
        dbTargetUserId: row.target_user_id,
        cookieTargetJson: JSON.stringify(cookieState.targetUserId),
        dbTargetJson: JSON.stringify(row.target_user_id),
        cookieTargetLen: String(cookieState.targetUserId ?? "").length,
        dbTargetLen: String(row.target_user_id ?? "").length,
        cookieTargetNorm,
        dbTargetNorm,
      });
      console.warn("[support-mode] wrong-target", {
        sessionId: row.session_id,
        cookieTarget: cookieState.targetUserId,
        dbTarget: row.target_user_id,
        cookieTargetJson: JSON.stringify(cookieState.targetUserId),
        dbTargetJson: JSON.stringify(row.target_user_id),
        cookieTargetLen: String(cookieState.targetUserId ?? "").length,
        dbTargetLen: String(row.target_user_id ?? "").length,
        cookieTargetNorm,
        dbTargetNorm,
        actorUserId,
      });
      return result;
    }

    if (!row || row.is_active !== true || !validRole) {
      const result: SupportModeValidationResult = {
        ok: false,
        reason: "invalid-session",
        actorUserId,
        sessionId: cookieState.sessionId,
        targetUserId: cookieState.targetUserId,
        hasCookies: cookieState.hasCookies,
      };
      log({
        ...result,
        clientType: "authed",
        rowPresent: Boolean(row),
        rpcRowCount,
        rpcTargetUserId: row?.target_user_id || null,
        rpcTargetRole: row?.target_role || null,
      });
      return result;
    }

    const result: SupportModeValidationResult = {
      ok: true,
      reason: "ok",
      actorUserId,
      sessionId: row.session_id,
      targetUserId: row.target_user_id,
      targetRole: row.target_role,
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
  const cookieState = await readSupportModeCookies();
  const validation = await validateSupportModeSession(actorUserId || null);

  if (!validation.ok) {
    return {
      supportMode: false,
      actorUserId: actorUserId || null,
      effectiveUserId: null,
      sessionId: null,
      targetUserId: null,
      targetRole: null,
      cookieTargetRole: cookieState.targetRole,
      homePath: "/admin/impersonation?error=missing-target-role",
      hasCookies: validation.hasCookies,
      reason: validation.reason,
    };
  }

  return {
    supportMode: true,
    actorUserId: validation.actorUserId,
    effectiveUserId: validation.targetUserId,
    sessionId: validation.sessionId,
    targetUserId: validation.targetUserId,
    targetRole: validation.targetRole,
    cookieTargetRole: cookieState.targetRole,
    homePath: getHomePathForRole(validation.targetRole),
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
