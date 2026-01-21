"use client";

import { getOrderStatusLabel } from "@/lib/orders";

export default function OrderStatusBadge({ status, label, className = "" }) {
  const text = label || getOrderStatusLabel(status);
  return (
    <span
      className={`status-badge inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${className}`}
      data-status={status}
    >
      {text}
    </span>
  );
}
