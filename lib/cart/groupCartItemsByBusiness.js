function resolveBusinessName(vendor) {
  if (!vendor) return "Local vendor";
  return vendor.business_name || vendor.full_name || "Local vendor";
}

/**
 * @param {Array<any>} items
 * @param {{
 *   vendorsById?: Record<string, any>,
 *   cartsByVendorId?: Record<string, any>
 * }} options
 */
export function groupCartItemsByBusiness(items = [], options = {}) {
  const vendorsById = options?.vendorsById || {};
  const cartsByVendorId = options?.cartsByVendorId || {};
  const groupsByBusinessId = new Map();

  for (const item of items) {
    const businessId = item?.vendor_id || item?.business_id || "unknown";
    const vendor = businessId && businessId !== "unknown" ? vendorsById[businessId] || null : null;
    const cart = businessId && businessId !== "unknown" ? cartsByVendorId[businessId] || null : null;

    if (!groupsByBusinessId.has(businessId)) {
      groupsByBusinessId.set(businessId, {
        business_id: businessId === "unknown" ? null : businessId,
        business_name: resolveBusinessName(vendor),
        cart_id: cart?.id || null,
        fulfillment_type: cart?.fulfillment_type || null,
        available_fulfillment_methods: cart?.available_fulfillment_methods || [],
        delivery_fee_cents:
          typeof cart?.delivery_fee_cents === "number" ? cart.delivery_fee_cents : 0,
        delivery_notes: cart?.delivery_notes || null,
        delivery_min_order_cents:
          typeof cart?.delivery_min_order_cents === "number"
            ? cart.delivery_min_order_cents
            : null,
        delivery_radius_miles:
          typeof cart?.delivery_radius_miles === "number"
            ? cart.delivery_radius_miles
            : null,
        delivery_unavailable_reason: cart?.delivery_unavailable_reason || null,
        vendor,
        items: [],
        subtotal: 0,
        item_count: 0,
      });
    }

    const group = groupsByBusinessId.get(businessId);
    const quantity = Number(item?.quantity || 0);
    const unitPrice = Number(item?.unit_price || 0);

    group.items.push(item);
    group.item_count += quantity;
    group.subtotal += unitPrice * quantity;
  }

  return Array.from(groupsByBusinessId.values()).sort((a, b) =>
    String(a.business_name || "").localeCompare(String(b.business_name || ""), "en", {
      sensitivity: "base",
    })
  );
}
