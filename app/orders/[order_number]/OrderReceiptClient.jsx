"use client";

import Link from "next/link";
import { formatEntityId } from "@/lib/entityIds";
import { getOrderStatusDescription, getOrderStatusLabel } from "@/lib/orders";

/** @typedef {import("@/lib/types/orders").Order} Order */
/** @typedef {import("@/lib/types/cart").VendorSummary} VendorSummary */

const formatMoney = (value) => {
  const amount = Number(value || 0);
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const STATUS_DOT_STYLES = {
  requested: { background: "#d97706" },
  pending_payment: { background: "rgba(110, 52, 255, 0.72)" },
  payment_failed: { background: "#b45309" },
  confirmed: { background: "#2563eb" },
  ready: { background: "#0f766e" },
  out_for_delivery: { background: "#0f766e" },
  fulfilled: { background: "#15803d" },
  completed: { background: "#15803d" },
  cancelled: { background: "#b91c1c" },
};

const NEXT_STEPS_COPY = {
  pending_payment: "Complete checkout to place the order.",
  payment_failed: "Complete checkout to place the order.",
  requested:
    "The business will review your order and confirm pickup details. You'll be notified when it's ready.",
  confirmed:
    "The business has confirmed your order and will share the next fulfillment update soon.",
  ready: "Your order is ready. Head to the business when you're able.",
  out_for_delivery: "Your order is on the way. Keep an eye out for delivery updates.",
  fulfilled: "This order has been completed.",
  completed: "This order has been completed.",
  cancelled: "This order has been cancelled.",
};

function getFulfillmentSummary(order) {
  if (order?.fulfillment_type === "delivery") {
    return `Delivery · ${order?.delivery_time || "ASAP"}`;
  }

  return `Pickup · ${order?.pickup_time || "ASAP"}`;
}

function getPaymentSummary(order) {
  if (order?.status === "pending_payment") {
    return "Complete Stripe Checkout to finalize your payment.";
  }

  if (order?.status === "payment_failed") {
    return "Stripe could not complete your payment.";
  }

  return "Payment completed with Stripe.";
}

function ReceiptItemName({ item }) {
  const title = item?.title || "Item";
  const listingExists = Boolean(item?.listing_id && item?.listing?.id);

  if (!listingExists) {
    return (
      <span title={item?.listing_id ? "Item no longer available" : undefined}>
        {title}
      </span>
    );
  }

  return (
    <Link
      href={`/listings/${item.listing_id}`}
      aria-label={`View item details for ${title}`}
      className="group inline-flex max-w-full items-center gap-1 text-inherit no-underline hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <span className="min-w-0 break-words">{title}</span>
      <span
        aria-hidden="true"
        className="shrink-0 opacity-0 transition-opacity group-hover:opacity-70 group-focus-visible:opacity-70"
      >
        &rarr;
      </span>
    </Link>
  );
}

function StatusHeader({
  order,
  mode,
  displayOrderId,
  statusTimestampLabel,
  backHref,
}) {
  const statusLabel = getOrderStatusLabel(order?.status);
  const isCheckoutMode = mode === "checkout";

  return (
    <section className="mb-8">
      <Link
        href={backHref || "/account/orders"}
        className="mb-4 inline-flex w-fit items-center text-sm font-medium text-slate-500 transition hover:text-[rgb(var(--brand-rgb))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-2"
      >
        <span aria-hidden="true">←</span>
        <span className="ml-1">Back to orders</span>
      </Link>

      <div>
        {!isCheckoutMode ? (
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Order details
          </p>
        ) : null}
        <h1 className="mb-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          {isCheckoutMode ? "Order confirmed" : `Order ${displayOrderId}`}
        </h1>
      </div>

      <p className="mb-3 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-5 text-slate-600">
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full"
            style={
              STATUS_DOT_STYLES[order?.status] || {
                background: "rgba(15, 23, 42, 0.45)",
              }
            }
          />
          <span className="font-medium text-slate-950">{statusLabel}</span>
        </span>
        <span className="text-slate-400" aria-hidden="true">
          ·
        </span>
        <span className="text-slate-500">{statusTimestampLabel}</span>
      </p>

    </section>
  );
}

/** @param {{ order: Order, vendor: VendorSummary, purchasedAtLabel: string, statusTimestampLabel: string, mode: "checkout" | "details", backHref?: string }} props */
export default function OrderReceiptClient({
  order,
  vendor,
  purchasedAtLabel,
  statusTimestampLabel,
  mode = "details",
  backHref = "/account/orders",
}) {
  const items = order?.order_items || [];
  const displayOrderId =
    formatEntityId("order", order?.order_number) || order?.order_number;
  const fulfillmentSummary = getFulfillmentSummary(order);
  const paymentSummary = getPaymentSummary(order);
  const isCheckoutMode = mode === "checkout";

  return (
    <div className="min-h-screen bg-[#f6f7fb] px-4 pb-14 pt-4 text-slate-950 sm:px-6 md:pb-16 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <StatusHeader
          order={order}
          mode={mode}
          displayOrderId={displayOrderId}
          statusTimestampLabel={statusTimestampLabel}
          backHref={backHref}
        />

        <div className="space-y-6 rounded-[24px] border border-slate-100 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.035)] sm:p-6 lg:p-7">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-base font-semibold text-slate-950">
                {isCheckoutMode ? "Receipt" : "Receipt and payment"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {paymentSummary}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Purchased {purchasedAtLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-9 w-fit items-center justify-center rounded-lg border border-slate-100 bg-white px-3 text-sm font-medium text-slate-600 transition hover:border-violet-100 hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-2"
            >
              Print receipt
            </button>
          </div>

          <div className="grid gap-5 text-sm md:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Vendor
              </p>
              <p className="font-semibold text-slate-950">
                {vendor?.business_name || vendor?.full_name || "Local vendor"}
              </p>
              {vendor?.city ? (
                <p className="text-sm text-slate-500">{vendor.city}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Fulfillment
              </p>
              {order?.fulfillment_type === "delivery" ? (
                <div className="space-y-2">
                  <div>
                    <p className="font-semibold leading-5 text-slate-950">Delivery</p>
                    <p className="mt-1 text-sm leading-5 text-slate-500">
                      {order.delivery_address1}
                      {order.delivery_address2 ? `, ${order.delivery_address2}` : ""}
                    </p>
                  </div>
                  {order?.delivery_instructions ? (
                    <div>
                      <p className="text-xs font-medium text-slate-500">Delivery instructions</p>
                      <p className="mt-1 text-sm leading-5 text-slate-500">
                        {order.delivery_instructions}
                      </p>
                    </div>
                  ) : null}
                  {order?.delivery_notes_snapshot ? (
                    <div>
                      <p className="text-xs font-medium text-slate-500">Delivery notes</p>
                      <p className="mt-1 text-sm leading-5 text-slate-500">
                        {order.delivery_notes_snapshot}
                      </p>
                    </div>
                  ) : null}
                  <p className="text-sm text-slate-500">{fulfillmentSummary}</p>
                </div>
              ) : (
                <div>
                  <p className="font-semibold leading-5 text-slate-950">Pickup</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Pickup time: {order.pickup_time || "ASAP"}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <div className="hidden grid-cols-[minmax(0,1fr)_4rem_6rem_6rem] gap-4 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:grid">
              <div>Item</div>
              <div className="text-right">Qty</div>
              <div className="text-right">Unit</div>
              <div className="text-right">Total</div>
            </div>

            <div className="divide-y divide-slate-100">
              {items.map((item) => {
                const lineTotal =
                  Number(item.unit_price || 0) * Number(item.quantity || 0);

                return (
                  <div
                    key={item.id}
                    className="grid gap-3 py-4 text-sm sm:grid-cols-[minmax(0,1fr)_4rem_6rem_6rem] sm:items-center sm:gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-start gap-3">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt=""
                            className="h-14 w-14 shrink-0 rounded-xl border border-slate-100 object-cover"
                          />
                        ) : (
                          <div className="h-14 w-14 shrink-0 rounded-xl border border-slate-100 bg-slate-50" />
                        )}
                        <div className="min-w-0 pt-0.5 font-medium leading-5 text-slate-800">
                          <ReceiptItemName item={item} />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                      <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400 sm:hidden">
                        Qty
                      </span>
                      <span className="text-slate-700">{item.quantity}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                      <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400 sm:hidden">
                        Unit
                      </span>
                      <span className="text-slate-700">${formatMoney(item.unit_price)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                      <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400 sm:hidden">
                        Total
                      </span>
                      <span className="font-medium text-slate-950">
                        ${formatMoney(lineTotal)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <div className="ml-auto max-w-sm space-y-2 text-sm">
              <div className="flex items-center justify-between gap-6">
                <span className="text-slate-500">Subtotal</span>
                <span>${formatMoney(order?.subtotal)}</span>
              </div>
              {Number(order?.delivery_fee_cents_snapshot || 0) > 0 ? (
                <div className="flex items-center justify-between gap-6">
                  <span className="text-slate-500">Delivery fee</span>
                  <span>
                    ${formatMoney(Number(order?.delivery_fee_cents_snapshot || 0) / 100)}
                  </span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-6">
                <span className="text-slate-500">Service fee</span>
                <span>${formatMoney(order?.fees)}</span>
              </div>
              <div className="flex items-center justify-between gap-6 border-t border-slate-100 pt-2">
                <span className="font-semibold text-slate-950">Total</span>
                <span className="font-semibold text-slate-950">
                  ${formatMoney(order?.total)}
                </span>
              </div>
              {order?.status === "pending_payment" ? (
                <p className="text-xs text-slate-500">
                  Your order will move forward after Stripe confirms payment.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
