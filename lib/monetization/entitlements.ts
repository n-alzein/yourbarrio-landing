import "server-only";

import { getSupabaseServerClient as getServiceRoleClient } from "@/lib/supabase/server";
import {
  FEATURES,
  FEATURE_KEYS,
  FOUNDING_PLAN_KEY,
  FREE_PLAN_KEY,
  METERED_LIMIT_FEATURE_BY_USAGE_FEATURE,
  type FeatureKey,
} from "@/lib/monetization/features";
import { getMonthlyUsagePeriod } from "@/lib/monetization/periods";

export type EntitlementSource = "override" | "plan" | "default" | "fallback";

export type EntitlementCheckResult = {
  allowed: boolean;
  featureKey: FeatureKey | string;
  value: unknown;
  source: EntitlementSource;
  reason?: string;
  limit?: number | null;
  used?: number;
  remaining?: number | null;
  billingStatus?: string | null;
};

export class BusinessEntitlementError extends Error {
  result: EntitlementCheckResult;

  constructor(result: EntitlementCheckResult) {
    super(result.reason || "This feature is not enabled for this business.");
    this.name = "BusinessEntitlementError";
    this.result = result;
  }
}

type SupabaseLike = any;

const FALLBACK_VALUES: Partial<Record<FeatureKey, unknown>> = {
  [FEATURES.INVENTORY_ONLINE_STOCK]: true,
  [FEATURES.INVENTORY_UNIQUE_ITEMS]: true,
  [FEATURES.INVENTORY_EXTERNAL_POS]: false,
  [FEATURES.INVENTORY_CAPACITY_BASED]: false,
  [FEATURES.LISTINGS_ACTIVE_LIMIT]: 50,
  [FEATURES.LISTINGS_IMAGES_PER_LISTING_LIMIT]: 8,
  [FEATURES.AI_PHOTO_ENHANCEMENT]: true,
  [FEATURES.AI_PHOTO_ENHANCEMENT_MONTHLY_LIMIT]: 100,
  [FEATURES.AI_DESCRIPTION_GENERATION]: true,
  [FEATURES.AI_DESCRIPTION_GENERATION_MONTHLY_LIMIT]: 100,
  [FEATURES.ANALYTICS_BASIC]: true,
  [FEATURES.ANALYTICS_ADVANCED]: false,
  [FEATURES.ORDERS_ONLINE_CHECKOUT]: true,
  [FEATURES.ORDERS_REQUEST_TO_BUY]: true,
  [FEATURES.ORDERS_BUSINESS_CONFIRMATION_REQUIRED]: false,
  [FEATURES.MESSAGING_CUSTOMER_BUSINESS]: true,
  [FEATURES.FEATURED_PLACEMENT]: true,
  [FEATURES.FEATURED_PLACEMENT_MONTHLY_CREDITS]: 5,
  [FEATURES.PROMOTIONS_SELF_SERVE]: false,
  [FEATURES.TEAM_MEMBERS_LIMIT]: 3,
  [FEATURES.STOREFRONT_CUSTOMIZATION]: true,
  [FEATURES.SUPPORT_PRIORITY]: false,
  [FEATURES.MARKETPLACE_TAKE_RATE_PERCENT]: 0,
  [FEATURES.MARKETPLACE_FIXED_FEE_CENTS]: 0,
};

function getClient(client?: SupabaseLike) {
  const resolved = client ?? getServiceRoleClient();
  if (!resolved) throw new Error("Missing Supabase service client");
  return resolved;
}

function unwrapJsonValue(value: unknown) {
  if (value && typeof value === "object" && "value" in (value as Record<string, unknown>)) {
    return (value as { value: unknown }).value;
  }
  return value;
}

function valueToBoolean(value: unknown) {
  const unwrapped = unwrapJsonValue(value);
  if (typeof unwrapped === "boolean") return unwrapped;
  if (typeof unwrapped === "number") return unwrapped > 0;
  if (typeof unwrapped === "string") return ["1", "true", "yes", "on"].includes(unwrapped.toLowerCase());
  return Boolean(unwrapped);
}

function valueToNumber(value: unknown): number | null {
  const unwrapped = unwrapJsonValue(value);
  if (unwrapped === null || unwrapped === undefined || unwrapped === "") return null;
  const next = Number(unwrapped);
  return Number.isFinite(next) ? next : null;
}

function isActiveOverride(override: any, now = new Date()) {
  if (override?.active === false) return false;
  const startsAt = override?.starts_at ? new Date(override.starts_at) : null;
  const endsAt = override?.ends_at ? new Date(override.ends_at) : null;
  if (startsAt && startsAt > now) return false;
  if (endsAt && endsAt <= now) return false;
  return true;
}

async function fetchFeature(client: SupabaseLike, featureKey: string) {
  const { data, error } = await client
    .from("monetization_features")
    .select("*")
    .eq("key", featureKey)
    .maybeSingle();
  if (error) throw new Error(error.message || "Failed to load monetization feature");
  return data || null;
}

export async function getBusinessSubscription(businessId: string, client?: SupabaseLike) {
  const supabase = getClient(client);
  const { data, error } = await supabase
    .from("business_subscriptions")
    .select("*, plan:monetization_plans(*)")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw new Error(error.message || "Failed to load business subscription");
  if (data?.id) return data;

  const { data: fallbackPlan, error: planError } = await supabase
    .from("monetization_plans")
    .select("*")
    .eq("key", FOUNDING_PLAN_KEY)
    .maybeSingle();
  if (planError) throw new Error(planError.message || "Failed to load fallback plan");

  return fallbackPlan
    ? {
        id: null,
        business_id: businessId,
        status: "founding",
        source: "fallback",
        plan_id: fallbackPlan.id,
        plan: fallbackPlan,
      }
    : null;
}

export async function getBusinessFeatureValue(
  businessId: string,
  featureKey: FeatureKey | string,
  client?: SupabaseLike
): Promise<{ value: unknown; source: EntitlementSource; billingStatus?: string | null }> {
  const supabase = getClient(client);
  const now = new Date();
  const feature = await fetchFeature(supabase, featureKey);

  if (!feature?.id) {
    return {
      value: FALLBACK_VALUES[featureKey as FeatureKey] ?? null,
      source: "fallback",
      billingStatus: null,
    };
  }

  const { data: overrides, error: overrideError } = await supabase
    .from("business_entitlement_overrides")
    .select("*")
    .eq("business_id", businessId)
    .eq("feature_id", feature.id)
    .eq("active", true)
    .order("created_at", { ascending: false });
  if (overrideError) throw new Error(overrideError.message || "Failed to load entitlement overrides");

  const activeOverrides = (Array.isArray(overrides) ? overrides : []).filter((override) =>
    isActiveOverride(override, now)
  );
  const deny = activeOverrides.find((override) => override.override_type === "deny");
  if (deny) return { value: false, source: "override", billingStatus: null };

  const setOrGrant = activeOverrides.find((override) =>
    ["grant", "set_limit"].includes(override.override_type)
  );
  if (setOrGrant) {
    let value = setOrGrant.override_type === "grant" ? true : setOrGrant.value;
    if (setOrGrant.override_type === "set_limit") {
      // `increase_limit` is additive and intentionally stacks, including on top of set_limit.
      const increases = activeOverrides.filter((override) => override.override_type === "increase_limit");
      for (const increase of increases) {
        const base = valueToNumber(value);
        const delta = valueToNumber(increase.value);
        if (base !== null && delta !== null) value = base + delta;
      }
    }
    return {
      value,
      source: "override",
      billingStatus: null,
    };
  }

  const subscription = await getBusinessSubscription(businessId, supabase);
  let planId = subscription?.plan_id || null;
  if (subscription?.status === "canceled") {
    const { data: freePlan, error: freeError } = await supabase
      .from("monetization_plans")
      .select("id")
      .eq("key", FREE_PLAN_KEY)
      .maybeSingle();
    if (freeError) throw new Error(freeError.message || "Failed to load free plan");
    planId = freePlan?.id || planId;
  }

  if (planId) {
    const { data: entitlement, error: entitlementError } = await supabase
      .from("monetization_plan_entitlements")
      .select("value")
      .eq("plan_id", planId)
      .eq("feature_id", feature.id)
      .maybeSingle();
    if (entitlementError) {
      throw new Error(entitlementError.message || "Failed to load plan entitlement");
    }
    if (entitlement) {
      let value = entitlement.value;
      // `increase_limit` is additive and intentionally stacks for temporary credits/manual bumps.
      const increases = activeOverrides.filter((override) => override.override_type === "increase_limit");
      for (const increase of increases) {
        const base = valueToNumber(value);
        const delta = valueToNumber(increase.value);
        if (base !== null && delta !== null) value = base + delta;
      }
      return {
        value,
        source: increases.length ? "override" : "plan",
        billingStatus: subscription?.status || null,
      };
    }
  }

  const fallback = feature.default_value ?? FALLBACK_VALUES[featureKey as FeatureKey] ?? null;
  return { value: fallback, source: feature.default_value === undefined ? "fallback" : "default", billingStatus: subscription?.status || null };
}

export async function getBusinessEntitlements(businessId: string, client?: SupabaseLike) {
  const entries = await Promise.all(
    FEATURE_KEYS.map(async (featureKey) => {
      const result = await getBusinessFeatureValue(businessId, featureKey, client);
      return [featureKey, result] as const;
    })
  );
  return Object.fromEntries(entries);
}

export async function getBusinessLimit(
  businessId: string,
  featureKey: FeatureKey | string,
  client?: SupabaseLike
) {
  const result = await getBusinessFeatureValue(businessId, featureKey, client);
  return valueToNumber(result.value);
}

export async function getBusinessUsage(
  businessId: string,
  featureKey: FeatureKey | string,
  date = new Date(),
  client?: SupabaseLike
) {
  const supabase = getClient(client);
  const feature = await fetchFeature(supabase, featureKey);
  if (!feature?.id) return { used: 0, reserved: 0, period: getMonthlyUsagePeriod(date) };
  const period = getMonthlyUsagePeriod(date);
  const { data, error } = await supabase
    .from("business_feature_usage")
    .select("used_count,reserved_count")
    .eq("business_id", businessId)
    .eq("feature_id", feature.id)
    .eq("period_start", period.periodStart)
    .eq("period_end", period.periodEnd)
    .maybeSingle();
  if (error) throw new Error(error.message || "Failed to load feature usage");
  return {
    used: Number(data?.used_count || 0),
    reserved: Number(data?.reserved_count || 0),
    period,
  };
}

export async function getBusinessRemainingUsage(
  businessId: string,
  featureKey: FeatureKey | string,
  date = new Date(),
  client?: SupabaseLike
) {
  const limitFeature = METERED_LIMIT_FEATURE_BY_USAGE_FEATURE[featureKey as FeatureKey] || featureKey;
  const [limit, usage] = await Promise.all([
    getBusinessLimit(businessId, limitFeature, client),
    getBusinessUsage(businessId, featureKey, date, client),
  ]);
  if (limit === null) return { limit: null, used: usage.used, remaining: null, period: usage.period };
  return {
    limit,
    used: usage.used,
    remaining: Math.max(0, limit - usage.used - usage.reserved),
    period: usage.period,
  };
}

export async function canBusinessUseFeature(
  businessId: string,
  featureKey: FeatureKey | string,
  client?: SupabaseLike
): Promise<EntitlementCheckResult> {
  const featureValue = await getBusinessFeatureValue(businessId, featureKey, client);
  const allowed = valueToBoolean(featureValue.value);
  const result: EntitlementCheckResult = {
    allowed,
    featureKey,
    value: featureValue.value,
    source: featureValue.source,
    billingStatus: featureValue.billingStatus ?? null,
    reason: allowed ? undefined : "This feature is not enabled for this business.",
  };

  const limitFeature = METERED_LIMIT_FEATURE_BY_USAGE_FEATURE[featureKey as FeatureKey];
  if (allowed && limitFeature) {
    const usage = await getBusinessRemainingUsage(businessId, featureKey, new Date(), client);
    result.limit = usage.limit;
    result.used = usage.used;
    result.remaining = usage.remaining;
    if (usage.remaining !== null && usage.remaining <= 0) {
      result.allowed = false;
      result.reason =
        featureKey === FEATURES.AI_PHOTO_ENHANCEMENT
          ? "You've reached this month's photo enhancement limit."
          : "You've reached this month's usage limit.";
    }
  }

  return result;
}

export async function assertBusinessCanUseFeature(
  businessId: string,
  featureKey: FeatureKey | string,
  client?: SupabaseLike
) {
  const result = await canBusinessUseFeature(businessId, featureKey, client);
  if (!result.allowed) throw new BusinessEntitlementError(result);
}

export async function consumeBusinessUsage(
  businessId: string,
  featureKey: FeatureKey | string,
  amount = 1,
  metadata: Record<string, unknown> = {},
  client?: SupabaseLike
) {
  const supabase = getClient(client);
  const check = await canBusinessUseFeature(businessId, featureKey, supabase);
  if (!check.allowed) throw new BusinessEntitlementError(check);
  const normalizedAmount = Math.max(1, Math.round(Number(amount || 1)));
  if (check.remaining !== null && check.remaining !== undefined && check.remaining < normalizedAmount) {
    throw new BusinessEntitlementError({
      ...check,
      allowed: false,
      reason: "You've reached this month's usage limit.",
    });
  }
  const limitFeature = METERED_LIMIT_FEATURE_BY_USAGE_FEATURE[featureKey as FeatureKey] || featureKey;
  const limit = await getBusinessLimit(businessId, limitFeature, supabase);
  const period = getMonthlyUsagePeriod();
  const { data, error } = await supabase.rpc("consume_business_feature_usage", {
    p_business_id: businessId,
    p_feature_key: featureKey,
    p_amount: normalizedAmount,
    p_period_start: period.periodStart,
    p_period_end: period.periodEnd,
    p_limit: limit,
    p_metadata: metadata,
  });
  if (error) throw new Error(error.message || "Failed to consume feature usage");
  if (data === false) {
    throw new BusinessEntitlementError({
      ...check,
      allowed: false,
      reason: "You've reached this month's usage limit.",
    });
  }
  return getBusinessUsage(businessId, featureKey, new Date(), supabase);
}

export async function resetBusinessUsage(
  businessId: string,
  featureKey: FeatureKey | string,
  date = new Date(),
  client?: SupabaseLike
) {
  const supabase = getClient(client);
  const feature = await fetchFeature(supabase, featureKey);
  if (!feature?.id) return;
  const period = getMonthlyUsagePeriod(date);
  const { error } = await supabase
    .from("business_feature_usage")
    .upsert(
      {
        business_id: businessId,
        feature_id: feature.id,
        period_start: period.periodStart,
        period_end: period.periodEnd,
        used_count: 0,
        reserved_count: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id,feature_id,period_start,period_end" }
    );
  if (error) throw new Error(error.message || "Failed to reset feature usage");
}

export async function getBusinessCommissionPolicy(businessId: string, client?: SupabaseLike) {
  const [takeRate, fixedFee] = await Promise.all([
    getBusinessFeatureValue(businessId, FEATURES.MARKETPLACE_TAKE_RATE_PERCENT, client),
    getBusinessFeatureValue(businessId, FEATURES.MARKETPLACE_FIXED_FEE_CENTS, client),
  ]);
  return {
    takeRatePercent: Math.max(0, valueToNumber(takeRate.value) ?? 0),
    fixedFeeCents: Math.max(0, Math.round(valueToNumber(fixedFee.value) ?? 0)),
    source: takeRate.source === "override" || fixedFee.source === "override" ? "override" : takeRate.source,
  };
}
