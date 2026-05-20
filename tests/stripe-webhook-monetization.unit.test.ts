import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const webhookSource = readFileSync(
  path.join(process.cwd(), "app/api/stripe/webhook/route.ts"),
  "utf8"
);
const checkoutSource = readFileSync(
  path.join(process.cwd(), "app/api/stripe/checkout/create-session/route.ts"),
  "utf8"
);

describe("Stripe monetization webhook hardening", () => {
  it("keeps existing order and Connect webhook handlers in place", () => {
    expect(webhookSource).toContain('case "account.updated"');
    expect(webhookSource).toContain('case "checkout.session.completed"');
    expect(webhookSource).toContain('case "payment_intent.succeeded"');
    expect(webhookSource).toContain('case "payment_intent.payment_failed"');
    expect(webhookSource).toContain("finalizePaidOrderFromCheckoutSession");
    expect(webhookSource).toContain("handleAccountUpdated");
  });

  it("records webhook idempotency and returns early for duplicate Stripe events", () => {
    expect(webhookSource).toContain('from("stripe_events").insert');
    expect(webhookSource).toContain('from("stripe_webhook_events").insert');
    expect(webhookSource).toContain("if (error.code === \"23505\") return { duplicate: true }");
    expect(webhookSource).toContain("if (state.duplicate)");
    expect(webhookSource).toContain("duplicate: true");
  });

  it("records failed webhook status and error details", () => {
    expect(webhookSource).toContain("processing_status: \"failed\"");
    expect(webhookSource).toContain("error_message: errorMessage");
    expect(webhookSource).toContain("await forgetEvent(client, event.id, error?.message || null)");
  });

  it("does not send application_fee_amount when calculated marketplace fee is zero", () => {
    expect(checkoutSource).toContain("calculateMarketplaceFeeForOrder");
    expect(checkoutSource).toContain("...(platformFeeAmount > 0 ? { application_fee_amount: platformFeeAmount } : {})");
  });
});

