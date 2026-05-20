import { NextResponse } from "next/server";
import { requireBusinessMonetizationAdminAccess } from "@/lib/monetization/access";
import { resetBusinessUsage } from "@/lib/monetization/entitlements";

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
  if (!featureKey) return jsonError("Missing feature key", 400);

  await resetBusinessUsage(businessId, featureKey, new Date(), access.serviceClient);
  await access.serviceClient.from("monetization_audit_events").insert({
    business_id: businessId,
    actor_user_id: access.actorUserId,
    event_type: "usage.reset",
    event_source: "admin",
    payload: { featureKey },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
