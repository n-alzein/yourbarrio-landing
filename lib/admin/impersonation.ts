import "server-only";

import { cookies } from "next/headers";
import { getAdminDataClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/permissions";

export const IMPERSONATE_USER_COOKIE = "yb_impersonate_user_id";
export const IMPERSONATE_SESSION_COOKIE = "yb_impersonate_session_id";

export type EffectiveUserContext = {
  effectiveUserId: string;
  activeImpersonation: {
    sessionId: string;
    targetUserId: string;
    targetUserName?: string | null;
    targetUserEmail?: string | null;
  } | null;
};

export async function getEffectiveUserId(): Promise<EffectiveUserContext> {
  const admin = await requireAdmin();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(IMPERSONATE_SESSION_COOKIE)?.value || "";
  const targetUserId = cookieStore.get(IMPERSONATE_USER_COOKIE)?.value || "";

  if (!sessionId || !targetUserId) {
    return { effectiveUserId: admin.user.id, activeImpersonation: null };
  }

  const { client } = await getAdminDataClient();
  const { data, error } = await client
    .from("admin_impersonation_sessions")
    .select("id, target_user_id, actor_user_id, expires_at, active, ended_at")
    .eq("id", sessionId)
    .eq("target_user_id", targetUserId)
    .eq("actor_user_id", admin.user.id)
    .maybeSingle();

  if (error || !data) {
    return { effectiveUserId: admin.user.id, activeImpersonation: null };
  }

  const isExpired = new Date(data.expires_at).getTime() <= Date.now();
  if (!data.active || data.ended_at || isExpired) {
    return { effectiveUserId: admin.user.id, activeImpersonation: null };
  }

  const { data: targetUser } = await client
    .from("users")
    .select("id, full_name, email")
    .eq("id", targetUserId)
    .maybeSingle();

  return {
    effectiveUserId: targetUserId,
    activeImpersonation: {
      sessionId,
      targetUserId,
      targetUserName: targetUser?.full_name ?? null,
      targetUserEmail: targetUser?.email ?? null,
    },
  };
}
