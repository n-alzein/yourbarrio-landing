import "server-only";

import { getAdminDataClient } from "@/lib/supabase/admin";

type AuditParams = {
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  meta?: Record<string, any> | null;
  actorUserId?: string;
};

type LogAdminActionParams = {
  action: string;
  actorUserId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  meta?: Record<string, any> | null;
};

const warnedActions = new Set<string>();
const diagEnabled =
  String(process.env.NEXT_PUBLIC_AUTH_DIAG || "") === "1" ||
  String(process.env.AUTH_GUARD_DIAG || "") === "1";
const shouldWarn = diagEnabled || process.env.NODE_ENV !== "production";

function warnAuditOnce(action: string, suffix: string, details: Record<string, unknown>) {
  if (!shouldWarn) return;
  const key = `${action}:${suffix}`;
  if (warnedActions.has(key)) return;
  warnedActions.add(key);
  console.warn("[admin-audit]", key, details);
}

export async function logAdminAction(
  client: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: any }> },
  {
    action,
    actorUserId = null,
    targetType = null,
    targetId = null,
    meta = {},
  }: LogAdminActionParams
) {
  const payload = {
    p_action: action,
    p_actor_user_id: actorUserId ?? null,
    p_target_type: targetType ?? "",
    p_target_id: String(targetId ?? ""),
    p_meta: meta ?? {},
  };

  try {
    const { data, error } = await client.rpc("log_admin_action", payload);
    if (error) {
      warnAuditOnce(action, error.code || "rpc_error", {
        message: error.message,
        code: error.code,
        hint: error.hint,
      });
      return null;
    }
    return data as string;
  } catch (error: any) {
    warnAuditOnce(action, "exception", {
      message: error?.message || "Unknown audit error",
      digest: error?.digest,
    });
    return null;
  }
}

export async function audit({
  action,
  targetType = null,
  targetId = null,
  meta = {},
  actorUserId,
}: AuditParams) {
  try {
    const { client } = await getAdminDataClient();
    // Non-fatal by design: admin UX (e.g. exit support mode) must not depend on audit availability.
    return await logAdminAction(client, {
      action,
      actorUserId: actorUserId ?? null,
      targetType: targetType ?? null,
      targetId: targetId ?? null,
      meta: meta ?? {},
    });
  } catch (error: any) {
    warnAuditOnce(action, "client_exception", {
      message: error?.message || "Unknown audit error",
      digest: error?.digest,
    });
    return null;
  }
}
