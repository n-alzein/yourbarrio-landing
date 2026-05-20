import "server-only";

import { monetizationConfig } from "@/lib/monetization/config";
import { getBusinessCommissionPolicy } from "@/lib/monetization/entitlements";

type CalculateMarketplaceFeeInput = {
  businessId: string;
  orderSubtotalCents: number;
  currency?: string | null;
  client?: any;
};

export async function calculateMarketplaceFeeForOrder({
  businessId,
  orderSubtotalCents,
  currency = "usd",
  client,
}: CalculateMarketplaceFeeInput) {
  const subtotal = Math.max(0, Math.round(Number(orderSubtotalCents || 0)));
  if (!monetizationConfig.marketplaceTakeRateEnabled || subtotal <= 0) {
    return {
      applicationFeeAmountCents: 0,
      takeRatePercent: 0,
      fixedFeeCents: 0,
      source: "default" as const,
      currency: String(currency || "usd").toLowerCase(),
    };
  }

  const policy = await getBusinessCommissionPolicy(businessId, client);
  const percentFee = Math.round(subtotal * (policy.takeRatePercent / 100));
  const rawFee = percentFee + policy.fixedFeeCents;
  return {
    applicationFeeAmountCents: Math.min(subtotal, Math.max(0, rawFee)),
    takeRatePercent: policy.takeRatePercent,
    fixedFeeCents: policy.fixedFeeCents,
    source: policy.source,
    currency: String(currency || "usd").toLowerCase(),
  };
}

