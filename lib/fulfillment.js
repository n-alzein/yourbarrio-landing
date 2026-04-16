export const PICKUP_FULFILLMENT_TYPE = "pickup";
export const DELIVERY_FULFILLMENT_TYPE = "delivery";

export const BUSINESS_FULFILLMENT_SELECT = [
  "pickup_enabled_default",
  "local_delivery_enabled_default",
  "default_delivery_fee_cents",
  "delivery_radius_miles",
  "delivery_min_order_cents",
  "delivery_notes",
].join(",");

export const LISTING_FULFILLMENT_SELECT = [
  "pickup_enabled",
  "local_delivery_enabled",
  "delivery_fee_cents",
  "use_business_delivery_defaults",
].join(",");

function asBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function asInteger(value, fallback = null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed);
}

function asNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asTrimmedString(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}

export function formatCents(cents) {
  const amount = Number(cents || 0) / 100;
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function dollarsInputToCents(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return Number.NaN;
  const parsed = Math.round(Number(trimmed) * 100);
  return parsed >= 0 ? parsed : Number.NaN;
}

export function centsToDollarsInput(value) {
  const cents = asInteger(value, null);
  if (cents === null || cents < 0) return "";
  return (cents / 100).toFixed(2);
}

export function getBusinessFulfillmentDefaults(business) {
  return {
    pickup_enabled_default: asBoolean(business?.pickup_enabled_default, true),
    local_delivery_enabled_default: asBoolean(
      business?.local_delivery_enabled_default,
      false
    ),
    default_delivery_fee_cents: asInteger(
      business?.default_delivery_fee_cents,
      null
    ),
    delivery_radius_miles: asNumber(business?.delivery_radius_miles, null),
    delivery_min_order_cents: asInteger(
      business?.delivery_min_order_cents,
      null
    ),
    delivery_notes: asTrimmedString(business?.delivery_notes),
  };
}

export function getEffectiveListingFulfillment(listing, business) {
  const businessDefaults = getBusinessFulfillmentDefaults(business);
  const pickupEnabled = asBoolean(listing?.pickup_enabled, true);
  const listingDeliveryEnabled = asBoolean(listing?.local_delivery_enabled, false);
  const useBusinessDeliveryDefaults = asBoolean(
    listing?.use_business_delivery_defaults,
    true
  );
  const deliveryFeeCents = useBusinessDeliveryDefaults
    ? businessDefaults.default_delivery_fee_cents
    : asInteger(listing?.delivery_fee_cents, null);

  const localDeliveryEnabled =
    businessDefaults.local_delivery_enabled_default && listingDeliveryEnabled;

  return {
    pickup_enabled: pickupEnabled,
    local_delivery_enabled: localDeliveryEnabled,
    use_business_delivery_defaults: useBusinessDeliveryDefaults,
    delivery_fee_cents: deliveryFeeCents,
    delivery_radius_miles: businessDefaults.delivery_radius_miles,
    delivery_min_order_cents: businessDefaults.delivery_min_order_cents,
    delivery_notes: businessDefaults.delivery_notes,
  };
}

export function deriveFulfillmentSummary({
  listings,
  business,
  subtotalCents = 0,
  currentFulfillmentType = null,
}) {
  const rows = Array.isArray(listings) ? listings : [];
  const effectiveListings = rows.map((listing) =>
    getEffectiveListingFulfillment(listing, business)
  );

  const pickupAvailable =
    effectiveListings.length > 0 &&
    effectiveListings.every((item) => item.pickup_enabled === true);

  const businessDefaults = getBusinessFulfillmentDefaults(business);
  const rawDeliveryFees = effectiveListings
    .map((item) => item.delivery_fee_cents)
    .filter((value) => value !== null);
  const uniqueDeliveryFees = [...new Set(rawDeliveryFees)];
  const deliveryMinOrderCents = businessDefaults.delivery_min_order_cents;
  const meetsDeliveryMinimum =
    deliveryMinOrderCents === null || subtotalCents >= deliveryMinOrderCents;

  let deliveryUnavailableReason = null;
  if (!effectiveListings.length) {
    deliveryUnavailableReason = "No items in cart.";
  } else if (!businessDefaults.local_delivery_enabled_default) {
    deliveryUnavailableReason = "This business has not enabled local delivery.";
  } else if (!effectiveListings.every((item) => item.local_delivery_enabled === true)) {
    deliveryUnavailableReason = "One or more items in this cart do not support local delivery.";
  } else if (uniqueDeliveryFees.length !== 1) {
    deliveryUnavailableReason =
      "This cart includes items with different delivery fees. Use pickup or separate the items.";
  } else if (rawDeliveryFees[0] === null || rawDeliveryFees[0] < 0) {
    deliveryUnavailableReason = "This business has not configured a delivery fee.";
  } else if (!meetsDeliveryMinimum) {
    deliveryUnavailableReason = "This cart does not meet the minimum for delivery.";
  }

  const deliveryAvailable = deliveryUnavailableReason === null;
  const availableMethods = [];
  if (pickupAvailable) availableMethods.push(PICKUP_FULFILLMENT_TYPE);
  if (deliveryAvailable) availableMethods.push(DELIVERY_FULFILLMENT_TYPE);

  let selectedFulfillmentType = currentFulfillmentType;
  if (!availableMethods.includes(selectedFulfillmentType)) {
    selectedFulfillmentType = pickupAvailable
      ? PICKUP_FULFILLMENT_TYPE
      : deliveryAvailable
        ? DELIVERY_FULFILLMENT_TYPE
        : null;
  }

  return {
    pickupAvailable,
    deliveryAvailable,
    deliveryUnavailableReason,
    availableMethods,
    selectedFulfillmentType,
    deliveryFeeCents: deliveryAvailable ? uniqueDeliveryFees[0] ?? 0 : 0,
    deliveryMinOrderCents,
    deliveryRadiusMiles: businessDefaults.delivery_radius_miles,
    deliveryNotes: businessDefaults.delivery_notes,
  };
}

export function isFulfillmentMethodAvailable(summary, method) {
  return Array.isArray(summary?.availableMethods)
    ? summary.availableMethods.includes(method)
    : false;
}
