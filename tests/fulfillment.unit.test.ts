import { describe, expect, it } from "vitest";
import {
  DELIVERY_FULFILLMENT_TYPE,
  PICKUP_FULFILLMENT_TYPE,
  deriveFulfillmentSummary,
} from "@/lib/fulfillment";

describe("deriveFulfillmentSummary", () => {
  it("defaults to pickup and keeps delivery hidden when business delivery is off", () => {
    const summary = deriveFulfillmentSummary({
      listings: [
        {
          pickup_enabled: true,
          local_delivery_enabled: true,
          use_business_delivery_defaults: true,
          delivery_fee_cents: null,
        },
      ],
      business: {
        pickup_enabled_default: true,
        local_delivery_enabled_default: false,
        default_delivery_fee_cents: 500,
      },
      subtotalCents: 1800,
      currentFulfillmentType: DELIVERY_FULFILLMENT_TYPE,
    });

    expect(summary.availableMethods).toEqual([PICKUP_FULFILLMENT_TYPE]);
    expect(summary.selectedFulfillmentType).toBe(PICKUP_FULFILLMENT_TYPE);
    expect(summary.deliveryAvailable).toBe(false);
  });

  it("adds an explicit delivery fee when delivery is valid", () => {
    const summary = deriveFulfillmentSummary({
      listings: [
        {
          pickup_enabled: true,
          local_delivery_enabled: true,
          use_business_delivery_defaults: false,
          delivery_fee_cents: 700,
        },
      ],
      business: {
        pickup_enabled_default: true,
        local_delivery_enabled_default: true,
        default_delivery_fee_cents: 500,
        delivery_notes: "Leave at front desk",
      },
      subtotalCents: 2500,
      currentFulfillmentType: DELIVERY_FULFILLMENT_TYPE,
    });

    expect(summary.availableMethods).toContain(DELIVERY_FULFILLMENT_TYPE);
    expect(summary.deliveryFeeCents).toBe(700);
    expect(summary.selectedFulfillmentType).toBe(DELIVERY_FULFILLMENT_TYPE);
    expect(summary.deliveryNotes).toBe("Leave at front desk");
  });

  it("prevents delivery for mixed-fee carts", () => {
    const summary = deriveFulfillmentSummary({
      listings: [
        {
          pickup_enabled: true,
          local_delivery_enabled: true,
          use_business_delivery_defaults: false,
          delivery_fee_cents: 500,
        },
        {
          pickup_enabled: true,
          local_delivery_enabled: true,
          use_business_delivery_defaults: false,
          delivery_fee_cents: 900,
        },
      ],
      business: {
        pickup_enabled_default: true,
        local_delivery_enabled_default: true,
        default_delivery_fee_cents: 500,
      },
      subtotalCents: 4000,
      currentFulfillmentType: DELIVERY_FULFILLMENT_TYPE,
    });

    expect(summary.deliveryAvailable).toBe(false);
    expect(summary.availableMethods).toEqual([PICKUP_FULFILLMENT_TYPE]);
    expect(summary.deliveryUnavailableReason).toContain("different delivery fees");
  });
});
