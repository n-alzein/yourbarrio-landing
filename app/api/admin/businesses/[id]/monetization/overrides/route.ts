import { NextResponse } from "next/server";
import { requireBusinessMonetizationAdminAccess } from "@/lib/monetization/access";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function getBusinessId(params: any) {
  const resolved = typeof params?.then === "function" ? await params : params;
  return String(resolved?.id || resolved?.businessId || "").trim();
}

export async function POST(request: Request, { params }: { params: any }) {
  const businessId = await getBusinessId(params);
  if (!businessId) return jsonError("Missing business id", 400);
  const access = await requireBusinessMonetizationAdminAccess(businessId);
  if (!access.ok) return jsonError(access.error, access.status);

  const body = await request.json().catch(() => ({}));
  const featureKey = String(body?.featureKey || body?.feature_key || "").trim();
  const overrideType = String(body?.overrideType || body?.override_type || "").trim();
  if (!featureKey || !overrideType) return jsonError("Missing override fields", 400);
  if (!["grant", "deny", "set_limit", "increase_limit"].includes(overrideType)) {
    return jsonError("Invalid override type", 400);
  }

  const { data: feature, error: featureError } = await access.serviceClient
    .from("monetization_features")
    .select("id,key")
    .eq("key", featureKey)
    .maybeSingle();
  if (featureError) return jsonError(featureError.message || "Failed to load feature", 500);
  if (!feature?.id) return jsonError("Feature not found", 404);

  const { data, error } = await access.serviceClient
    .from("business_entitlement_overrides")
    .insert({
      business_id: businessId,
      feature_id: feature.id,
      override_type: overrideType,
      value: body?.value ?? null,
      reason: body?.reason || null,
      starts_at: body?.startsAt || body?.starts_at || null,
      ends_at: body?.endsAt || body?.ends_at || null,
      created_by: access.actorUserId,
    })
    .select("*, feature:monetization_features(*)")
    .single();
  if (error) return jsonError(error.message || "Failed to create override", 500);

  await access.serviceClient.from("monetization_audit_events").insert({
    business_id: businessId,
    actor_user_id: access.actorUserId,
    event_type: "entitlement_override.created",
    event_source: "admin",
    payload: { featureKey, overrideType, value: body?.value ?? null },
  });

  return NextResponse.json({ override: data }, { status: 201 });
}
