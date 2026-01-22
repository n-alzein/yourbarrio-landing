"use client";

import { formatOrderDateTime } from "@/lib/orders";

/** @typedef {import("@/lib/types/orders").Order} Order */
/** @typedef {import("@/lib/types/cart").VendorSummary} VendorSummary */

const formatMoney = (value) => {
  const amount = Number(value || 0);
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const statusCopy = {
  requested: "Request received",
  confirmed: "Confirmed",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  fulfilled: "Fulfilled",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** @param {{ order: Order, vendor: VendorSummary }} props */
export default function OrderReceiptClient({ order, vendor }) {
  const items = order?.order_items || [];
  const statusLabel = statusCopy[order?.status] || "Processing";

  return (
    <div className="min-h-screen px-4 md:px-8 lg:px-12 py-12" style={{ background: "var(--background)", color: "var(--text)" }}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.2em] opacity-70">Order confirmation</p>
          <h1 className="text-3xl font-semibold">Order {order?.order_number}</h1>
          <p className="text-sm opacity-80">Status: {statusLabel}</p>
          <p className="text-xs opacity-70 mb-3">
            Purchased {formatOrderDateTime(order?.created_at)}
          </p>
        </div>

        <div className="rounded-3xl p-6 space-y-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Receipt</p>
              <p className="text-xs opacity-70 mb-6">Payment collected at pickup/delivery</p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-full px-4 py-2 text-xs font-semibold"
              style={{ background: "var(--text)", color: "var(--background)" }}
            >
              Print receipt
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] opacity-60">Vendor</p>
              <p className="font-semibold">{vendor?.business_name || vendor?.full_name || "Local vendor"}</p>
              {vendor?.city ? <p className="text-xs opacity-70">{vendor.city}</p> : null}
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] opacity-60">Fulfillment</p>
              <p className="font-semibold">{order?.fulfillment_type === "delivery" ? "Delivery" : "Pickup"}</p>
              {order?.fulfillment_type === "delivery" ? (
                <p className="text-xs opacity-70 mb-3">
                  {order.delivery_address1}
                  {order.delivery_address2 ? `, ${order.delivery_address2}` : ""}
                </p>
              ) : (
                <p className="text-xs opacity-70 mb-3">
                  Pickup time: {order.pickup_time || "ASAP"}
                </p>
              )}
            </div>
          </div>

          <div className="border-t pt-4 space-y-3" style={{ borderColor: "var(--border)" }}>
            <div className="text-xs uppercase tracking-[0.2em] opacity-60 grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-3 leading-none">
              <span className="relative -top-0.5">Item</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Unit</span>
              <span className="text-right">Total</span>
            </div>
            <div className="space-y-2 text-sm">
              {items.map((item) => (
                <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3">
                  <span className="opacity-80 max-w-[360px] md:max-w-[440px] break-words">
                    {item.title}
                  </span>
                  <span className="text-right">{item.quantity}</span>
                  <span className="text-right">
                    ${formatMoney(item.unit_price)}
                  </span>
                  <span className="text-right">
                    ${formatMoney(Number(item.unit_price || 0) * Number(item.quantity || 0))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t mt-4 pt-4 space-y-2 text-sm" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between">
              <span className="opacity-80">Subtotal</span>
              <span>${formatMoney(order?.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="opacity-80">Fees</span>
              <span>${formatMoney(order?.fees)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold">Total</span>
              <span className="font-semibold">${formatMoney(order?.total)}</span>
            </div>
            <p className="text-xs opacity-70">Totals may be estimates until confirmed.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
