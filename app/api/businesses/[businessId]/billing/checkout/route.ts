import { NextResponse } from "next/server";
import { monetizationConfig } from "@/lib/monetization/config";
import { requireBusinessMonetizationReadAccess } from "@/lib/monetization/access";
import {
  checkoutReturnUrls,
  getOrCreateStripeCustomerForBusiness,
} from "@/lib/monetization/stripeBilling";
import { getStripe } from "@/lib/stripe";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function getBusinessId(params: any) {
  const resolved = typeof params?.then === "function" ? await params : params;
  return String(resolved?.businessId || "").trim();
}

export async function POST(request: Request, { params }: { params: any }) {
  if (!monetizationConfig.billingCheckoutEnabled || !monetizationConfig.stripeBillingEnabled) {
    return jsonError("Billing checkout is not enabled.", 404);
  }

  const businessId = await getBusinessId(params);
  if (!businessId) return jsonError("Missing business id", 400);
  const access = await requireBusinessMonetizationReadAccess(businessId);
  if (!access.ok) return jsonError(access.error, access.status);

  const body = await request.json().catch(() => ({}));
  const planKey = String(body?.planKey || body?.plan_key || "").trim();
  const lookupKey = String(body?.lookupKey || body?.lookup_key || "").trim();
  if (!planKey && !lookupKey) return jsonError("Missing plan key or lookup key", 400);

  let plan: any = null;
  if (planKey) {
    const { data, error } = await access.serviceClient
      .from("monetization_plans")
      .select("*")
      .eq("key", planKey)
      .maybeSingle();
    if (error) return jsonError(error.message || "Failed to load plan", 500);
    plan = data;
  } else {
    const { data, error } = await access.serviceClient
      .from("monetization_plans")
      .select("*")
      .eq("stripe_lookup_key", lookupKey)
      .maybeSingle();
    if (error) return jsonError(error.message || "Failed to load plan", 500);
    plan = data;
  }

  if (!plan?.id) return jsonError("Plan not found", 404);
  const priceLookupKey = lookupKey || plan.stripe_lookup_key;
  const priceId = plan.stripe_monthly_price_id || plan.stripe_annual_price_id;
  if (!priceLookupKey && !priceId) return jsonError("Plan is not mapped to a Stripe price.", 400);

  const customerId = await getOrCreateStripeCustomerForBusiness(businessId, access.serviceClient);
  const urls = checkoutReturnUrls(businessId);
  const stripe = getStripe();
  let resolvedPriceId = priceId;
  if (!resolvedPriceId && priceLookupKey) {
    const prices = await stripe.prices.list({ lookup_keys: [priceLookupKey], active: true, limit: 1 });
    resolvedPriceId = prices.data[0]?.id || null;
  }
  if (!resolvedPriceId) return jsonError("Stripe price not found for this plan.", 400);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    success_url: urls.successUrl,
    cancel_url: urls.cancelUrl,
    line_items: [{ price: resolvedPriceId, quantity: 1 }],
    subscription_data: {
      metadata: {
        business_id: businessId,
        plan_key: plan.key,
      },
    },
    metadata: {
      business_id: businessId,
      plan_key: plan.key,
    },
  });

  if (!session.url) return jsonError("Stripe did not return a checkout URL", 500);
  return NextResponse.json({ url: session.url }, { status: 200 });
}
