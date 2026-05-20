import { NextResponse } from "next/server";
import { requireBusinessMonetizationAdminAccess } from "@/lib/monetization/access";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function getBusinessId(params: any) {
  const resolved = typeof params?.then === "function" ? await params : params;
  return String(resolved?.businessId || "").trim();
}

export async function POST(request: Request, { params }: { params: any }) {
  const businessId = await getBusinessId(params);
  if (!businessId) return jsonError("Missing business id", 400);

  const access = await requireBusinessMonetizationAdminAccess(businessId);
  if (!access.ok) return jsonError(access.error, access.status);

  const body = await request.json().catch(() => ({}));
  const planKey = String(body?.planKey || body?.plan_key || "").trim();
  const status = String(body?.status || "").trim() || null;
  const foundingEndsAt = body?.foundingEndsAt || body?.founding_ends_at || null;
  if (!planKey) return jsonError("Missing plan key", 400);

  const { data: plan, error: planError } = await access.serviceClient
    .from("monetization_plans")
    .select("id,key")
    .eq("key", planKey)
    .maybeSingle();
  if (planError) return jsonError(planError.message || "Failed to load plan", 500);
  if (!plan?.id) return jsonError("Plan not found", 404);

  const payload = {
    business_id: businessId,
    plan_id: plan.id,
    status: status || (plan.key === "founding_business" ? "founding" : plan.key === "free" ? "free" : "manual"),
    source: "admin",
    founding_ends_at: foundingEndsAt,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await access.serviceClient
    .from("business_subscriptions")
    .upsert(payload, { onConflict: "business_id" })
    .select("*, plan:monetization_plans(*)")
    .single();
  if (error) return jsonError(error.message || "Failed to update plan", 500);

  await access.serviceClient.from("monetization_audit_events").insert({
    business_id: businessId,
    actor_user_id: access.actorUserId,
    event_type: "subscription.admin_updated",
    event_source: "admin",
    payload: { planKey, status: payload.status, foundingEndsAt },
  });

  return NextResponse.json({ subscription: data }, { status: 200 });
}

