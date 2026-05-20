import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/monetization/entitlements", () => ({
  getBusinessCommissionPolicy: vi.fn(async () => ({
    takeRatePercent: 10,
    fixedFeeCents: 50,
    source: "plan",
  })),
}));

describe("marketplace monetization fees", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.MARKETPLACE_TAKE_RATE_ENABLED;
  });

  it("returns zero while marketplace take-rate is disabled", async () => {
    const { calculateMarketplaceFeeForOrder } = await import("@/lib/monetization/fees");
    await expect(
      calculateMarketplaceFeeForOrder({ businessId: "business-1", orderSubtotalCents: 1000 })
    ).resolves.toMatchObject({
      applicationFeeAmountCents: 0,
      takeRatePercent: 0,
      fixedFeeCents: 0,
      source: "default",
    });
  });

  it("uses percent and fixed fee when enabled", async () => {
    process.env.MARKETPLACE_TAKE_RATE_ENABLED = "true";
    const { calculateMarketplaceFeeForOrder } = await import("@/lib/monetization/fees");
    await expect(
      calculateMarketplaceFeeForOrder({ businessId: "business-1", orderSubtotalCents: 1000 })
    ).resolves.toMatchObject({
      applicationFeeAmountCents: 150,
      takeRatePercent: 10,
      fixedFeeCents: 50,
    });
  });

  it("caps fee at order subtotal", async () => {
    process.env.MARKETPLACE_TAKE_RATE_ENABLED = "true";
    const { calculateMarketplaceFeeForOrder } = await import("@/lib/monetization/fees");
    await expect(
      calculateMarketplaceFeeForOrder({ businessId: "business-1", orderSubtotalCents: 25 })
    ).resolves.toMatchObject({
      applicationFeeAmountCents: 25,
    });
  });
});

