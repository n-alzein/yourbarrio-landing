export function envFlag(name: string, defaultValue = false) {
  const value = process.env[name];
  if (value === undefined || value === null || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

export const monetizationConfig = {
  monetizationEnabled: envFlag("MONETIZATION_ENABLED", true),
  stripeBillingEnabled: envFlag("STRIPE_BILLING_ENABLED", false),
  billingCheckoutEnabled: envFlag("BILLING_CHECKOUT_ENABLED", false),
  billingPortalEnabled: envFlag("BILLING_PORTAL_ENABLED", false),
  marketplaceTakeRateEnabled: envFlag("MARKETPLACE_TAKE_RATE_ENABLED", false),
  promotionsEnabled: envFlag("PROMOTIONS_ENABLED", false),
};

