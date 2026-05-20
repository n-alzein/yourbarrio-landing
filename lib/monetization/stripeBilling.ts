import "server-only";

import type Stripe from "stripe";
import { getAppUrl, getStripe } from "@/lib/stripe";

export async function getOrCreateStripeCustomerForBusiness(
  businessId: string,
  client: any
) {
  const { data: subscription, error: subscriptionError } = await client
    .from("business_subscriptions")
    .select("id,stripe_customer_id")
    .eq("business_id", businessId)
    .maybeSingle();
  if (subscriptionError) throw new Error(subscriptionError.message || "Failed to load subscription");
  if (subscription?.stripe_customer_id) return subscription.stripe_customer_id as string;

  const { data: business, error: businessError } = await client
    .from("businesses")
    .select("id,business_name,owner_user_id")
    .eq("id", businessId)
    .maybeSingle();
  if (businessError) throw new Error(businessError.message || "Failed to load business");
  if (!business?.id) throw new Error("Business not found");

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    name: business.business_name || undefined,
    metadata: {
      business_id: business.id,
      business_name: business.business_name || "",
      environment: process.env.NODE_ENV || "development",
    },
  });

  const { error: updateError } = await client
    .from("business_subscriptions")
    .update({
      stripe_customer_id: customer.id,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId);
  if (updateError) throw new Error(updateError.message || "Failed to save Stripe customer");

  return customer.id;
}

export function getSubscriptionPeriodDates(subscription: Stripe.Subscription) {
  const item = subscription.items?.data?.[0] || null;
  const currentPeriodStart = item?.current_period_start
    ? new Date(item.current_period_start * 1000).toISOString()
    : null;
  const currentPeriodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000).toISOString()
    : null;
  return { currentPeriodStart, currentPeriodEnd };
}

export async function findPlanByStripeSubscription(subscription: Stripe.Subscription, client: any) {
  const item = subscription.items?.data?.[0] || null;
  const priceId = typeof item?.price?.id === "string" ? item.price.id : null;
  const productId =
    typeof item?.price?.product === "string" ? item.price.product : item?.price?.product?.id || null;
  const lookupKey = typeof item?.price?.lookup_key === "string" ? item.price.lookup_key : null;

  let query = client.from("monetization_plans").select("*").limit(1);
  if (priceId) {
    const { data } = await query.or(`stripe_monthly_price_id.eq.${priceId},stripe_annual_price_id.eq.${priceId}`);
    if (Array.isArray(data) && data[0]) return data[0];
  }
  if (lookupKey) {
    const { data } = await client
      .from("monetization_plans")
      .select("*")
      .eq("stripe_lookup_key", lookupKey)
      .limit(1);
    if (Array.isArray(data) && data[0]) return data[0];
  }
  if (productId) {
    const { data } = await client
      .from("monetization_plans")
      .select("*")
      .eq("stripe_product_id", productId)
      .limit(1);
    if (Array.isArray(data) && data[0]) return data[0];
  }
  return null;
}

export function checkoutReturnUrls(businessId: string) {
  const appUrl = getAppUrl();
  return {
    successUrl: `${appUrl}/business/dashboard?billing=success&business_id=${encodeURIComponent(businessId)}`,
    cancelUrl: `${appUrl}/business/dashboard?billing=cancelled`,
    returnUrl: `${appUrl}/business/dashboard?billing=portal_return`,
  };
}

