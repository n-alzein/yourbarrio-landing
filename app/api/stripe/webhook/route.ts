import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  finalizePaidOrderFromCheckoutSession,
  finalizePaidOrderFromPaymentIntent,
  expireStripeCheckoutSession,
  markStripePaymentFailed,
} from "@/lib/orders/persistence";
import { monetizationConfig } from "@/lib/monetization/config";
import {
  findPlanByStripeSubscription,
  getSubscriptionPeriodDates,
} from "@/lib/monetization/stripeBilling";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function markEventStarted(client: any, event: Stripe.Event) {
  await client.from("stripe_webhook_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event as any,
    processing_status: "pending",
  }).then((result: any) => {
    if (!result?.error || result.error.code === "23505" || result.error.code === "42P01") return result;
    throw new Error(result.error.message || "Failed to store Stripe webhook event");
  });

  const { error } = await client.from("stripe_events").insert({
    id: event.id,
    type: event.type,
    payload: event as any,
  });

  if (!error) return { duplicate: false };
  if (error.code === "23505") return { duplicate: true };
  throw new Error(error.message || "Failed to store Stripe event");
}

async function forgetEvent(client: any, eventId: string, errorMessage?: string | null) {
  await client.from("stripe_events").delete().eq("id", eventId);
  await client
    .from("stripe_webhook_events")
    .update({
      processing_status: "failed",
      error_message: errorMessage || "Failed to process Stripe webhook",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_event_id", eventId);
}

async function handleAccountUpdated(client: any, account: Stripe.Account) {
  const accountId = account.id?.trim();
  if (!accountId) return;

  const { error } = await client
    .from("businesses")
    .update({
      stripe_charges_enabled: account.charges_enabled === true,
      stripe_payouts_enabled: account.payouts_enabled === true,
      stripe_details_submitted: account.details_submitted === true,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_account_id", accountId);

  if (error) {
    throw new Error(error.message || "Failed to update business Stripe status");
  }
}

async function handleCheckoutCompleted(
  client: any,
  session: Stripe.Checkout.Session
) {
  if (session.mode === "subscription") {
    await linkSubscriptionCheckoutSession(client, session);
    return null;
  }
  const result = await finalizePaidOrderFromCheckoutSession({
    client,
    session,
    logPrefix: "[ORDER_FINALIZATION_TRACE]",
  });
  return result;
}

async function handlePaymentIntentSucceeded(
  client: any,
  paymentIntent: Stripe.PaymentIntent
) {
  const result = await finalizePaidOrderFromPaymentIntent({
    client,
    paymentIntent,
    logPrefix: "[ORDER_FINALIZATION_TRACE]",
  });
  return result;
}

async function handlePaymentIntentFailed(
  client: any,
  paymentIntent: Stripe.PaymentIntent
) {
  await markStripePaymentFailed({
    client,
    paymentIntent,
    logPrefix: "[ORDER_FINALIZATION_TRACE]",
  });
}

async function handleCheckoutExpired(
  client: any,
  session: Stripe.Checkout.Session
) {
  await expireStripeCheckoutSession({
    client,
    session,
    logPrefix: "[ORDER_FINALIZATION_TRACE]",
  });
}

function stripeStatusToInternalStatus(status?: string | null) {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
      return "canceled";
    case "paused":
      return "paused";
    default:
      return status || "manual";
  }
}

async function logMonetizationAudit(client: any, payload: Record<string, unknown>) {
  await client.from("monetization_audit_events").insert({
    business_id: payload.businessId || null,
    event_type: String(payload.eventType || "stripe.event"),
    event_source: "stripe",
    payload,
  });
}

async function linkSubscriptionCheckoutSession(client: any, session: Stripe.Checkout.Session) {
  if (!monetizationConfig.stripeBillingEnabled) return;
  const businessId = String(session.metadata?.business_id || "").trim();
  if (!businessId) return;
  await client
    .from("business_subscriptions")
    .update({
      stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id || null,
      stripe_subscription_id:
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null,
      source: "stripe",
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId);
  await logMonetizationAudit(client, {
    businessId,
    eventType: "billing.checkout_completed",
    stripeSessionId: session.id,
    stripeSubscriptionId:
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null,
  });
}

async function applyStripeSubscription(client: any, subscription: Stripe.Subscription, deleted = false) {
  if (!monetizationConfig.stripeBillingEnabled) return;
  const businessId = String(subscription.metadata?.business_id || "").trim();
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id || null;
  const lookupBusinessId = businessId || null;
  const plan = deleted ? null : await findPlanByStripeSubscription(subscription, client);
  const { data: freePlan } = deleted
    ? await client.from("monetization_plans").select("id").eq("key", "free").maybeSingle()
    : { data: null };
  const { currentPeriodStart, currentPeriodEnd } = getSubscriptionPeriodDates(subscription);
  const payload: Record<string, unknown> = {
    status: deleted ? "canceled" : stripeStatusToInternalStatus(subscription.status),
    source: "stripe",
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_subscription_item_id: subscription.items?.data?.[0]?.id || null,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end === true,
    updated_at: new Date().toISOString(),
  };
  if (plan?.id) payload.plan_id = plan.id;
  if (deleted && freePlan?.id) payload.plan_id = freePlan.id;

  let query = client.from("business_subscriptions").update(payload);
  if (lookupBusinessId) query = query.eq("business_id", lookupBusinessId);
  else if (customerId) query = query.eq("stripe_customer_id", customerId);
  else return;
  await query;

  await logMonetizationAudit(client, {
    businessId: lookupBusinessId,
    eventType: deleted ? "billing.subscription_deleted" : "billing.subscription_updated",
    stripeSubscriptionId: subscription.id,
    stripeStatus: subscription.status,
    mappedPlanKey: plan?.key || null,
  });
}

async function markSubscriptionPastDue(client: any, invoice: Stripe.Invoice) {
  if (!monetizationConfig.stripeBillingEnabled) return;
  const invoiceLike = invoice as any;
  const subscriptionId =
    typeof invoiceLike.subscription === "string" ? invoiceLike.subscription : invoiceLike.subscription?.id || null;
  if (!subscriptionId) return;
  await client
    .from("business_subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscriptionId);
  await logMonetizationAudit(client, {
    eventType: "billing.invoice_payment_failed",
    stripeSubscriptionId: subscriptionId,
    stripeInvoiceId: invoice.id,
  });
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return jsonError("Missing Stripe signature", 400);
  }

  const client = getSupabaseServerClient();
  if (!client) {
    return jsonError("Missing server data client", 500);
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      getStripeWebhookSecret()
    );
  } catch (error: any) {
    return jsonError(error?.message || "Invalid Stripe signature", 400);
  }

  try {
    const state = await markEventStarted(client, event);
    if (state.duplicate) {
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    }

    if (process.env.NODE_ENV !== "production") {
      console.warn("[ORDER_FINALIZATION_TRACE]", "stripe_event_received", {
        eventId: event.id,
        eventType: event.type,
      });
    }

    switch (event.type) {
      case "account.updated":
        await handleAccountUpdated(client, event.data.object as Stripe.Account);
        break;
      case "checkout.session.completed":
        {
          const result = await handleCheckoutCompleted(
          client,
          event.data.object as Stripe.Checkout.Session
        );
        }
        break;
      case "checkout.session.expired":
        await handleCheckoutExpired(
          client,
          event.data.object as Stripe.Checkout.Session
        );
        break;
      case "payment_intent.succeeded":
        {
          const result = await handlePaymentIntentSucceeded(
          client,
          event.data.object as Stripe.PaymentIntent
        );
        }
        break;
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(
          client,
          event.data.object as Stripe.PaymentIntent
        );
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
      case "customer.subscription.trial_will_end":
        await applyStripeSubscription(client, event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await applyStripeSubscription(client, event.data.object as Stripe.Subscription, true);
        break;
      case "invoice.paid":
        {
          const invoice = event.data.object as any;
          const subscriptionId =
            typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id || null;
          if (subscriptionId && monetizationConfig.stripeBillingEnabled) {
            await client
              .from("business_subscriptions")
              .update({ status: "active", updated_at: new Date().toISOString() })
              .eq("stripe_subscription_id", subscriptionId);
          }
        }
        break;
      case "invoice.payment_failed":
        await markSubscriptionPastDue(client, event.data.object as Stripe.Invoice);
        break;
      case "entitlements.active_entitlement_summary.updated":
        await logMonetizationAudit(client, {
          eventType: "billing.stripe_entitlements_updated",
          stripeEventId: event.id,
        });
        break;
      default:
        break;
    }

    await client
      .from("stripe_webhook_events")
      .update({
        processing_status: "processed",
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_event_id", event.id);

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    await forgetEvent(client, event.id, error?.message || null);
    return jsonError(error?.message || "Failed to process Stripe webhook", 500);
  }
}
