import { describe, expect, it } from "vitest";
import { groupCartItemsByBusiness } from "@/lib/cart/groupCartItemsByBusiness";

describe("groupCartItemsByBusiness", () => {
  it("groups items by vendor and computes per-vendor subtotals", () => {
    const items = [
      { id: "1", vendor_id: "vendor-a", title: "A1", quantity: 2, unit_price: 5 },
      { id: "2", vendor_id: "vendor-a", title: "A2", quantity: 1, unit_price: 3.5 },
      { id: "3", vendor_id: "vendor-b", title: "B1", quantity: 4, unit_price: 2.25 },
    ];

    const groups = groupCartItemsByBusiness(items, {
      vendorsById: {
        "vendor-a": { id: "vendor-a", business_name: "Vendor A" },
        "vendor-b": { id: "vendor-b", business_name: "Vendor B" },
      },
      cartsByVendorId: {
        "vendor-a": {
          id: "cart-a",
          fulfillment_type: "delivery",
          available_fulfillment_methods: ["pickup", "delivery"],
          delivery_fee_cents: 500,
        },
        "vendor-b": { id: "cart-b", fulfillment_type: "pickup" },
      },
    });

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      business_id: "vendor-a",
      business_name: "Vendor A",
      cart_id: "cart-a",
      fulfillment_type: "delivery",
      delivery_fee_cents: 500,
      item_count: 3,
      subtotal: 13.5,
    });
    expect(groups[1]).toMatchObject({
      business_id: "vendor-b",
      business_name: "Vendor B",
      cart_id: "cart-b",
      fulfillment_type: "pickup",
      item_count: 4,
      subtotal: 9,
    });
  });

  it("falls back to a local vendor label when vendor metadata is missing", () => {
    const groups = groupCartItemsByBusiness([{ id: "1", vendor_id: "vendor-z", quantity: 1, unit_price: 1 }]);
    expect(groups).toHaveLength(1);
    expect(groups[0].business_name).toBe("Local vendor");
    expect(groups[0].subtotal).toBe(1);
  });
});
