import { NextResponse } from "next/server";
import { requireBusinessMonetizationAdminAccess } from "@/lib/monetization/access";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function getParams(params: any) {
  const resolved = typeof params?.then === "function" ? await params : params;
  return {
    businessId: String(resolved?.businessId || "").trim(),
    overrideId: String(resolved?.overrideId || "").trim(),
  };
}

export async function DELETE(_request: Request, { params }: { params: any }) {
  const { businessId, overrideId } = await getParams(params);
  if (!businessId || !overrideId) return jsonError("Missing override id", 400);
  const access = await requireBusinessMonetizationAdminAccess(businessId);
  if (!access.ok) return jsonError(access.error, access.status);

  const { error } = await access.serviceClient
    .from("business_entitlement_overrides")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", overrideId)
    .eq("business_id", businessId);
  if (error) return jsonError(error.message || "Failed to revoke override", 500);

  await access.serviceClient.from("monetization_audit_events").insert({
    business_id: businessId,
    actor_user_id: access.actorUserId,
    event_type: "entitlement_override.revoked",
    event_source: "admin",
    payload: { overrideId },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}

