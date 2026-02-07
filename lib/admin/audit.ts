import "server-only";

import { getAdminDataClient } from "@/lib/supabase/admin";

type AuditParams = {
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  meta?: Record<string, any>;
  actorUserId?: string;
};

export async function audit({
  action,
  targetType = null,
  targetId = null,
  meta = {},
  actorUserId,
}: AuditParams) {
  const { client } = await getAdminDataClient();

  const { data, error } = await client.rpc("log_admin_action", {
    p_action: action,
    p_target_type: targetType,
    p_target_id: targetId,
    p_meta: meta,
    p_actor_user_id: actorUserId ?? null,
  });

  if (error) {
    throw new Error(`Failed to write audit log: ${error.message}`);
  }

  return data as string;
}
