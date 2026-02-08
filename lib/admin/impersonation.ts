import "server-only";

import { getAdminDataClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/permissions";
import {
  getSupportModeFromCookies,
} from "@/lib/admin/supportMode";

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
  const supportMode = await getSupportModeFromCookies(admin.user.id);
  if (!supportMode.supportMode) {
    return { effectiveUserId: admin.user.id, activeImpersonation: null };
  }

  const { client } = await getAdminDataClient({ mode: "service" });
  const { data: targetUser } = await client
    .from("users")
    .select("id, full_name, email")
    .eq("id", supportMode.targetUserId)
    .maybeSingle();

  return {
    effectiveUserId: supportMode.targetUserId,
    activeImpersonation: {
      sessionId: supportMode.sessionId,
      targetUserId: supportMode.targetUserId,
      targetUserName: targetUser?.full_name ?? null,
      targetUserEmail: targetUser?.email ?? null,
    },
  };
}
