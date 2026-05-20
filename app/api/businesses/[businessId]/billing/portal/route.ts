import { NextResponse } from "next/server";
import { monetizationConfig } from "@/lib/monetization/config";
import { requireBusinessMonetizationReadAccess } from "@/lib/monetization/access";
import { checkoutReturnUrls } from "@/lib/monetization/stripeBilling";
import { getStripe } from "@/lib/stripe";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function getBusinessId(params: any) {
  const resolved = typeof params?.then === "function" ? await params : params;
  return String(resolved?.businessId || "").trim();
}

export async function POST(_request: Request, { params }: { params: any }) {
  if (!monetizationConfig.billingPortalEnabled || !monetizationConfig.stripeBillingEnabled) {
    return jsonError("Billing portal is not enabled.", 404);
  }

  const businessId = await getBusinessId(params);
  if (!businessId) return jsonError("Missing business id", 400);
  const access = await requireBusinessMonetizationReadAccess(businessId);
  if (!access.ok) return jsonError(access.error, access.status);

  const { data: subscription, error } = await access.serviceClient
    .from("business_subscriptions")
    .select("stripe_customer_id")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) return jsonError(error.message || "Failed to load subscription", 500);
  if (!subscription?.stripe_customer_id) return jsonError("Stripe customer not found.", 400);

  const session = await getStripe().billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: checkoutReturnUrls(businessId).returnUrl,
  });

  return NextResponse.json({ url: session.url }, { status: 200 });
}

