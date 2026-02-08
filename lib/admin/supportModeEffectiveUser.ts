import "server-only";

import { getEffectiveActorAndTarget } from "@/lib/admin/supportMode";
import { getSupabaseServerAdminClient } from "@/lib/supabase/admin";

export type SupportModeEffectiveUser =
  | {
      isSupportMode: true;
      actorUserId: string;
      targetUserId: string;
      targetRole: "customer" | "business";
      sessionId: string;
      reason: "ok";
    }
  | {
      isSupportMode: false;
      actorUserId: string | null;
      targetUserId: null;
      targetRole: null;
      sessionId: null;
      reason: string;
    };

export async function getSupportModeEffectiveUser(
  actorUserId: string | null
): Promise<SupportModeEffectiveUser> {
  const resolved = await getEffectiveActorAndTarget(actorUserId);
  if (!resolved.supportMode) {
    return {
      isSupportMode: false,
      actorUserId: resolved.actorUserId,
      targetUserId: null,
      targetRole: null,
      sessionId: null,
      reason: resolved.reason,
    };
  }

  let targetRole: "customer" | "business" | null = resolved.targetRole;
  if (!targetRole) {
    try {
      const adminClient = getSupabaseServerAdminClient();
      const { data } = await adminClient
        .from("users")
        .select("role")
        .eq("id", resolved.targetUserId)
        .maybeSingle();
      targetRole = data?.role === "business" ? "business" : "customer";
    } catch {
      targetRole = null;
    }
  }

  if (!targetRole) {
    return {
      isSupportMode: false,
      actorUserId: resolved.actorUserId,
      targetUserId: null,
      targetRole: null,
      sessionId: null,
      reason: "missing-target-role",
    };
  }

  return {
    isSupportMode: true,
    actorUserId: resolved.actorUserId,
    targetUserId: resolved.targetUserId,
    targetRole,
    sessionId: resolved.sessionId,
    reason: "ok",
  };
}
