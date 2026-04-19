import {
  formatLocalDateGroupLabel,
  formatLocalDateTime,
  formatLocalTime,
  getLocalDateKey,
  parseIsoDateTime,
} from "@/lib/utils/datetime";

export const ORDER_STATUS_LABELS = {
  pending_payment: "Pending payment",
  payment_failed: "Payment failed",
  requested: "Requested",
  confirmed: "Confirmed",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
  completed: "Completed",
};

export const ORDER_STATUS_DESCRIPTIONS = {
  pending_payment: "Complete Stripe Checkout to place the order.",
  payment_failed: "Payment did not complete. Try checkout again.",
  requested: "We received the order request.",
  confirmed: "The vendor confirmed the order.",
  ready: "Your order is ready for pickup.",
  out_for_delivery: "Your order is on the way.",
  fulfilled: "Order completed.",
  cancelled: "Order cancelled.",
  completed: "Order completed.",
};

export const formatMoney = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const formatOrderDateTime = (value) => {
  return formatLocalDateTime(value);
};

export const getOrderPurchaseTimestamp = (order) =>
  order?.paid_at || order?.created_at || null;

export const formatOrderPurchaseDateTime = (order) =>
  formatOrderDateTime(getOrderPurchaseTimestamp(order));

export const formatOrderPurchaseTime = (order) =>
  formatLocalTime(getOrderPurchaseTimestamp(order));

export const compareOrdersByPurchaseRecency = (left, right) => {
  const leftTime = parseIsoDateTime(getOrderPurchaseTimestamp(left))?.getTime() ?? 0;
  const rightTime = parseIsoDateTime(getOrderPurchaseTimestamp(right))?.getTime() ?? 0;

  if (rightTime !== leftTime) return rightTime - leftTime;

  return String(right?.id || "").localeCompare(String(left?.id || ""));
};

export const sortOrdersByPurchaseRecency = (orders = []) =>
  [...orders].sort(compareOrdersByPurchaseRecency);

export const groupOrdersByPurchaseDate = (orders = [], now = new Date()) => {
  const groups = [];
  const groupIndexByDate = new Map();

  sortOrdersByPurchaseRecency(orders).forEach((order) => {
    const timestamp = getOrderPurchaseTimestamp(order);
    const dateKey = getLocalDateKey(timestamp);
    let group = groupIndexByDate.get(dateKey);

    if (!group) {
      group = {
        key: dateKey,
        label: formatLocalDateGroupLabel(timestamp, now),
        orders: [],
      };
      groupIndexByDate.set(dateKey, group);
      groups.push(group);
    }

    group.orders.push(order);
  });

  return groups;
};

export const getOrderStatusLabel = (status) =>
  ORDER_STATUS_LABELS[status] || status || "Unknown";

export const getOrderStatusDescription = (status) =>
  ORDER_STATUS_DESCRIPTIONS[status] || "Order in progress.";
