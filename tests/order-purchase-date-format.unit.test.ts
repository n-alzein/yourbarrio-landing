import { describe, expect, it } from "vitest";

import {
  formatOrderDateTime,
  formatOrderPurchaseDateTime,
  groupOrdersByPurchaseDate,
  getOrderPurchaseTimestamp,
  sortOrdersByPurchaseRecency,
} from "@/lib/orders";

describe("order purchase date formatting", () => {
  it("uses the same source timestamp and formatter for history and receipt labels", () => {
    const order = {
      created_at: "2026-04-19T10:00:00.000Z",
      updated_at: "2026-04-19T12:00:00.000Z",
      fulfilled_at: "2026-04-19T13:00:00.000Z",
      paid_at: "2026-04-19T11:00:00.000Z",
    };

    const historyLabel = formatOrderPurchaseDateTime(order);
    const receiptLabel = formatOrderPurchaseDateTime(order);

    expect(getOrderPurchaseTimestamp(order)).toBe(order.paid_at);
    expect(receiptLabel).toBe(historyLabel);
    expect(receiptLabel).toBe(formatOrderDateTime(order.paid_at));
    expect(receiptLabel).not.toBe(formatOrderDateTime(order.fulfilled_at));
  });

  it("falls back to created_at when paid_at is missing", () => {
    const order = {
      created_at: "2026-04-19T10:00:00.000Z",
      paid_at: null,
    };

    expect(getOrderPurchaseTimestamp(order)).toBe(order.created_at);
    expect(formatOrderPurchaseDateTime(order)).toBe(formatOrderDateTime(order.created_at));
  });

  it("formats equivalent timezone-sensitive ISO instants the same way", () => {
    const withOffset = {
      created_at: "2026-04-19T10:15:00-03:00",
    };
    const asUtc = {
      created_at: "2026-04-19T13:15:00.000Z",
    };

    expect(formatOrderPurchaseDateTime(withOffset)).toBe(formatOrderPurchaseDateTime(asUtc));
  });

  it("sorts orders by canonical purchase timestamp descending", () => {
    const orders = [
      { id: "older-paid", created_at: "2026-04-19T08:00:00.000Z", paid_at: "2026-04-19T09:00:00.000Z" },
      { id: "fallback-created", created_at: "2026-04-19T11:00:00.000Z", paid_at: null },
      { id: "newest-paid", created_at: "2026-04-19T07:00:00.000Z", paid_at: "2026-04-19T12:00:00.000Z" },
    ];

    expect(sortOrdersByPurchaseRecency(orders).map((order) => order.id)).toEqual([
      "newest-paid",
      "fallback-created",
      "older-paid",
    ]);
  });

  it("groups orders by local purchase date while preserving newest-first order", () => {
    const todayMorning = new Date(2026, 3, 19, 9, 0).toISOString();
    const todayAfternoon = new Date(2026, 3, 19, 15, 0).toISOString();
    const yesterday = new Date(2026, 3, 18, 15, 0).toISOString();
    const groups = groupOrdersByPurchaseDate(
      [
        { id: "today-morning", created_at: todayMorning, paid_at: null },
        { id: "yesterday", created_at: yesterday, paid_at: null },
        { id: "today-afternoon", created_at: todayAfternoon, paid_at: null },
      ],
      new Date(2026, 3, 19, 18, 0)
    );

    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe("Today");
    expect(groups[0].orders.map((order) => order.id)).toEqual(["today-afternoon", "today-morning"]);
    expect(groups[1].label).toBe("Yesterday");
    expect(groups[1].orders.map((order) => order.id)).toEqual(["yesterday"]);
  });
});
