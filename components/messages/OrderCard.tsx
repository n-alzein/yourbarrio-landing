"use client";

import Link from "next/link";
import { Check } from "lucide-react";

type OrderCardItem = {
  name?: string | null;
  image_url?: string | null;
};

type OrderCardProps = {
  orderId: string;
  orderNumber: string;
  businessName?: string | null;
  items?: OrderCardItem[];
  statusHistory?: string[];
  updatedAt?: string | null;
  fulfillmentType?: string | null;
  viewHref?: string;
};

const STATUS_LABELS: Record<string, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  ready: "Ready for pickup",
  out_for_delivery: "Out for delivery",
  fulfilled: "Fulfilled",
  completed: "Fulfilled",
  cancelled: "Cancelled",
  payment_failed: "Payment failed",
  pending_payment: "Pending payment",
};

function formatStatus(value?: string | null) {
  if (!value) return "";
  return (
    STATUS_LABELS[value] ||
    value
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function formatUpdatedAt(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function OrderCard({
  orderId,
  orderNumber,
  businessName,
  items = [],
  statusHistory = [],
  updatedAt,
  fulfillmentType,
  viewHref,
}: OrderCardProps) {
  const normalizedHistory = statusHistory
    .map((status) => String(status || "").trim())
    .filter(Boolean);
  const historySet = new Set(normalizedHistory);
  const isPickup = fulfillmentType === "pickup";
  const steps = [
    "confirmed",
    ...(isPickup ? ["ready"] : []),
    "fulfilled",
  ];
  const visibleItems = items.filter(Boolean).slice(0, 3);
  const extraCount = Math.max(0, items.length - visibleItems.length);
  const updatedLabel = formatUpdatedAt(updatedAt);
  const href =
    viewHref ||
    (orderNumber ? `/orders/${encodeURIComponent(orderNumber)}` : "/account/orders");

  return (
    <article
      className="my-4 w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 text-slate-950 shadow-sm"
      aria-label={`Order ${orderNumber || orderId}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">
            Order {orderNumber || orderId}
          </h3>
          {businessName ? (
            <p className="mt-0.5 text-xs text-slate-500">{businessName}</p>
          ) : null}
        </div>
        {fulfillmentType ? (
          <span className="rounded-full bg-[#dccbff]/60 px-2.5 py-1 text-[11px] font-medium capitalize text-[#4c1d95]">
            {fulfillmentType}
          </span>
        ) : null}
      </div>

      {visibleItems.length ? (
        <div className="mt-4 flex items-center gap-2">
          {visibleItems.map((item, index) => (
            <div
              key={`${item?.image_url || item?.name || "item"}-${index}`}
              className="h-12 w-12 overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
              title={item?.name || "Order item"}
            >
              {item?.image_url ? (
                <img
                  src={item.image_url}
                  alt={item?.name || "Order item"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-[#dccbff]/40" />
              )}
            </div>
          ))}
          {extraCount > 0 ? (
            <div className="flex h-12 min-w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
              +{extraCount}
            </div>
          ) : null}
        </div>
      ) : null}

      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {steps.map((step) => {
          const completed = historySet.has(step);
          return (
            <li key={step} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                  completed
                    ? "border-[#7c3aed] bg-[#7c3aed] !text-white"
                    : "border-slate-300 bg-white text-slate-400"
                }`}
              >
                {completed ? (
                  <Check className="h-3.5 w-3.5 !text-white !stroke-white stroke-[2.5]" />
                ) : null}
              </span>
              <span
                className={`text-xs ${
                  completed ? "font-semibold text-slate-950" : "text-slate-500"
                }`}
              >
                {formatStatus(step)}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <p className="text-xs text-slate-500">
          {updatedLabel ? `Updated at ${updatedLabel}` : "Updated recently"}
        </p>
        <Link
          href={href}
          className="inline-flex h-9 items-center rounded-full bg-[#7c3aed] px-4 text-xs font-semibold !text-white transition hover:bg-[#6d28d9] hover:!text-white focus-visible:!text-white"
        >
          View order
        </Link>
      </div>
    </article>
  );
}
