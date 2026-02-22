import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/admin/audit";
import { CUSTOMER_NEARBY_PUBLIC_FLAG_KEY } from "@/lib/featureFlags";
import { getAdminServiceRoleClient } from "@/lib/supabase/admin";
import { getSupabaseServerAuthedClient } from "@/lib/supabaseServer";

const payloadSchema = z.object({
  enabled: z.boolean(),
});

const REQUIRED_ROLE = "admin_super";

export async function POST(request: Request) {
  const authedClient = await getSupabaseServerAuthedClient();
  if (!authedClient) {
    return NextResponse.json(
      { error: "Authentication client unavailable" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const {
    data: { user: actorUser },
    error: authError,
  } = await authedClient.auth.getUser();

  if (authError || !actorUser) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const adminClient = getAdminServiceRoleClient();
  const { data: actorRoles, error: actorRolesError } = await adminClient
    .from("admin_role_members")
    .select("role_key")
    .eq("user_id", actorUser.id);

  if (actorRolesError) {
    return NextResponse.json(
      { error: "Failed to verify admin role" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const isSuperAdmin = (actorRoles || []).some(
    (row) => String(row?.role_key || "") === REQUIRED_ROLE
  );

  if (!isSuperAdmin) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  const enabled = parsed.data.enabled === true;

  const { error: updateError } = await adminClient
    .from("feature_flags")
    .upsert(
      {
        key: CUSTOMER_NEARBY_PUBLIC_FLAG_KEY,
        enabled,
        updated_by: actorUser.id,
      },
      { onConflict: "key", ignoreDuplicates: false }
    );

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message || "Failed to update feature flag" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    await audit({
      action: "feature_flag_update",
      targetType: "feature_flag",
      targetId: CUSTOMER_NEARBY_PUBLIC_FLAG_KEY,
      actorUserId: actorUser.id,
      meta: {
        key: CUSTOMER_NEARBY_PUBLIC_FLAG_KEY,
        enabled,
      },
    });
  } catch {
    // Non-blocking audit by design.
  }

  return NextResponse.json(
    { ok: true, enabled },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
