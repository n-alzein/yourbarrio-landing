"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import OrderStatusBadge from "@/components/orders/OrderStatusBadge";
import {
  formatMoney,
  formatOrderDateTime,
  getOrderStatusDescription,
  getOrderStatusLabel,
} from "@/lib/orders";

const TABS = [
  { id: "new", label: "New" },
  { id: "progress", label: "In progress" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

const DATE_RANGES = [
  { id: "all", label: "All time" },
  { id: "7", label: "Last 7 days" },
  { id: "30", label: "Last 30 days" },
];

const baseButton =
  "inline-flex items-center justify-center rounded-full px-4 h-9 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60 focus-visible:ring-offset-2";

const fieldBase =
  "w-full rounded-full border px-4 h-11 text-sm bg-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60 focus-visible:ring-offset-2";

export default function BusinessOrdersClient() {
  const searchParams = useSearchParams();
  const initialTab = searchParams?.get("tab") || "new";
  const orderParam = searchParams?.get("order") || "";
  const [activeTab, setActiveTab] = useState(
    TABS.some((tab) => tab.id === initialTab) ? initialTab : "new"
  );
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState("all");

  const loadOrders = async (tabId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/business/orders?tab=${tabId}`, {
        credentials: "include",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load orders");
      }
      setOrders(payload?.orders || []);
    } catch (err) {
      setError(err?.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedOrder(null);
    loadOrders(activeTab);
  }, [activeTab]);

  useEffect(() => {
    setSelectedOrder(null);
  }, [orderParam]);

  const getOrderActions = (order) => {
    if (!order) return [];
    const actions = [];
    if (order.status === "requested") {
      actions.push({ label: "Confirm", status: "confirmed" });
      actions.push({ label: "Cancel", status: "cancelled" });
    }
    if (order.status === "confirmed") {
      actions.push({ label: "Mark ready", status: "ready" });
      actions.push({ label: "Cancel", status: "cancelled" });
    }
    if (order.status === "ready") {
      if (order.fulfillment_type === "delivery") {
        actions.push({ label: "Out for delivery", status: "out_for_delivery" });
      }
      actions.push({ label: "Mark fulfilled", status: "fulfilled" });
    }
    if (order.status === "out_for_delivery") {
      actions.push({ label: "Mark fulfilled", status: "fulfilled" });
    }
    return actions;
  };

  const filteredOrders = useMemo(() => {
    let next = [...orders];
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      next = next.filter((order) => {
        const haystack = [
          order.order_number,
          order.contact_name,
          order.contact_phone,
          order.contact_email,
          order.total,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      });
    }
    if (dateRange !== "all") {
      const days = Number(dateRange);
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      next = next.filter((order) => {
        const createdAt = Date.parse(order.created_at);
        if (Number.isNaN(createdAt)) return true;
        return createdAt >= cutoff;
      });
    }
    return next;
  }, [orders, searchTerm, dateRange]);

  const orderActions = useMemo(
    () => getOrderActions(selectedOrder),
    [selectedOrder]
  );

  const handleStatusUpdate = async (orderId, nextStatus) => {
    setUpdatingId(orderId);
    try {
      const response = await fetch("/api/business/orders", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, status: nextStatus }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update order");
      }
      setOrders((prev) =>
        Array.isArray(prev)
          ? prev.map((order) =>
              order.id === orderId ? { ...order, ...payload.order } : order
            )
          : []
      );
      setSelectedOrder((prev) => {
        if (!prev || prev.id !== orderId) return prev;
        return { ...prev, ...payload.order };
      });
    } catch (err) {
      setError(err?.message || "Failed to update order");
    } finally {
      setUpdatingId(null);
    }
  };

  const isFiltered = searchTerm.trim() || dateRange !== "all";
  const emptyTitle =
    orders.length === 0
      ? "No orders in this view"
      : "No orders match those filters";
  const emptyBody =
    orders.length === 0
      ? "New orders will show up here when customers submit requests."
      : "Try clearing filters or searching with a different keyword.";

  return (
    <div
      className="min-h-screen px-4 md:px-8 lg:px-12 pt-1 pb-12"
      style={{ background: "var(--background)", color: "var(--text)" }}
    >
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] opacity-70">
            Orders
          </p>
          <h1 className="text-3xl font-semibold">Manage orders</h1>
          <p className="text-sm opacity-70 mb-4">
            Track requests, update fulfillment, and keep customers informed.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="rounded-full px-4 h-10 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60 focus-visible:ring-offset-2"
              style={
                activeTab === tab.id
                  ? { background: "var(--text)", color: "var(--background)" }
                  : { border: "1px solid var(--border)" }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
            <input
              type="search"
              placeholder="Search by order number, customer, or phone"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className={`${fieldBase} pl-11 pr-10`}
              style={{ borderColor: "var(--border)" }}
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60 focus-visible:ring-offset-2"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="order-date-range" className="sr-only">
              Date range
            </label>
            <select
              id="order-date-range"
              value={dateRange}
              onChange={(event) => setDateRange(event.target.value)}
              className={fieldBase}
              style={{ borderColor: "var(--border)" }}
            >
              {DATE_RANGES.map((range) => (
                <option key={range.id} value={range.id}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>
          <div className="text-xs opacity-70">
            {filteredOrders.length}{" "}
            {filteredOrders.length === 1 ? "order" : "orders"}
          </div>
        </div>

        {error ? (
          <div
            className="rounded-2xl p-4 text-sm text-rose-600 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => loadOrders(activeTab)}
              className={`${baseButton} border`}
              style={{ borderColor: "var(--border)" }}
            >
              Retry
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-5">
            <div className="md:hidden space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`skeleton-card-${index}`}
                  className="rounded-3xl p-5 animate-pulse"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div className="h-4 w-32 rounded bg-black/10 mb-3" />
                  <div className="h-3 w-48 rounded bg-black/10 mb-2" />
                  <div className="h-3 w-36 rounded bg-black/10 mb-4" />
                  <div className="h-8 w-full rounded-full bg-black/10" />
                </div>
              ))}
            </div>
            <div
              className="hidden md:block rounded-3xl overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="max-h-[520px] overflow-auto">
                <table className="min-w-full text-sm border-separate [border-spacing:0_8px]">
                  <thead
                    className="sticky top-0 z-10 text-[10px] uppercase tracking-[0.2em] opacity-70"
                    style={{
                      background: "var(--surface)",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <tr>
                      {["Order", "Customer", "Fulfillment", "Schedule", "Status", "Total", ""].map(
                        (label) => (
                          <th key={label} className="py-3 px-4 text-left font-semibold">
                            {label}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 6 }).map((_, index) => (
                      <tr key={`skeleton-row-${index}`}>
                        {Array.from({ length: 7 }).map((__, cell) => (
                          <td key={`cell-${cell}`} className="py-4 px-4">
                            <div className="h-3 w-full rounded bg-black/10" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div
            className="rounded-3xl p-8 text-center"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <h2 className="text-xl font-semibold">{emptyTitle}</h2>
            <p className="mt-2 text-sm opacity-80">{emptyBody}</p>
            {isFiltered ? (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setDateRange("all");
                }}
                className={`${baseButton} mt-5 border`}
                style={{ borderColor: "var(--border)" }}
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-5">
            <div
              className="hidden md:block rounded-3xl overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="max-h-[520px] overflow-auto">
                <table className="min-w-full text-sm border-separate [border-spacing:0_8px]">
                  <thead
                    className="sticky top-0 z-10 text-[10px] uppercase tracking-[0.2em] opacity-70"
                    style={{
                      background: "var(--surface)",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <tr>
                      <th className="py-3 px-4 text-left font-semibold">Order</th>
                      <th className="py-3 px-4 text-left font-semibold">Customer</th>
                      <th className="py-3 px-4 text-left font-semibold">
                        Fulfillment
                      </th>
                      <th className="py-3 px-4 text-left font-semibold">Schedule</th>
                      <th className="py-3 px-4 text-left font-semibold">Status</th>
                      <th className="py-3 px-4 text-right font-semibold">Total</th>
                      <th className="py-3 px-4 text-right font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => {
                      const schedule =
                        order.fulfillment_type === "delivery"
                          ? order.delivery_time
                          : order.pickup_time;
                      const actions = getOrderActions(order);
                      const primaryAction = actions[0];
                      return (
                        <tr key={order.id} className="hover:bg-[var(--overlay)]">
                          <td className="py-4 px-4">
                            <div className="space-y-1">
                              <p className="font-semibold">
                                Order {order.order_number}
                              </p>
                              <p className="text-xs opacity-70">
                                {formatOrderDateTime(order.created_at)}
                              </p>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="space-y-1">
                              <p className="font-semibold">
                                {order.contact_name || "Customer"}
                              </p>
                              <p className="text-xs opacity-70">
                                {order.contact_phone || order.contact_email || "—"}
                              </p>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-xs uppercase tracking-[0.12em] opacity-70">
                              {order.fulfillment_type === "delivery"
                                ? "Delivery"
                                : "Pickup"}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-xs opacity-70">
                              {schedule || "ASAP"}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <OrderStatusBadge status={order.status} />
                          </td>
                          <td className="py-4 px-4 text-right font-semibold">
                            ${formatMoney(order.total)}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedOrder(order)}
                                className={`${baseButton} border`}
                                style={{ borderColor: "var(--border)" }}
                              >
                                View
                              </button>
                              {primaryAction ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleStatusUpdate(order.id, primaryAction.status)
                                  }
                                  disabled={updatingId === order.id}
                                  className={baseButton}
                                  style={{
                                    background: "var(--text)",
                                    color: "var(--background)",
                                    opacity: updatingId === order.id ? 0.7 : 1,
                                  }}
                                >
                                  {updatingId === order.id
                                    ? "Updating..."
                                    : primaryAction.label}
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="md:hidden space-y-5">
              {filteredOrders.map((order) => {
                const schedule =
                  order.fulfillment_type === "delivery"
                    ? order.delivery_time
                    : order.pickup_time;
                const actions = getOrderActions(order);
                const primaryAction = actions[0];
                return (
                  <div
                    key={order.id}
                    className="rounded-3xl p-5 space-y-5"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">
                          Order {order.order_number}
                        </p>
                        <p className="text-xs opacity-70">
                          {formatOrderDateTime(order.created_at)}
                        </p>
                      </div>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="space-y-1">
                        <p className="uppercase tracking-[0.18em] opacity-60">
                          Customer
                        </p>
                        <p className="text-sm font-semibold">
                          {order.contact_name || "Customer"}
                        </p>
                        <p className="opacity-70">
                          {order.contact_phone || order.contact_email || "—"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="uppercase tracking-[0.18em] opacity-60">
                          Fulfillment
                        </p>
                        <p className="text-sm font-semibold">
                          {order.fulfillment_type === "delivery"
                            ? "Delivery"
                            : "Pickup"}
                        </p>
                        <p className="opacity-70">{schedule || "ASAP"}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">
                        ${formatMoney(order.total)}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          className={`${baseButton} border`}
                          style={{ borderColor: "var(--border)" }}
                        >
                          View
                        </button>
                        {primaryAction ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleStatusUpdate(order.id, primaryAction.status)
                            }
                            disabled={updatingId === order.id}
                            className={baseButton}
                            style={{
                              background: "var(--text)",
                              color: "var(--background)",
                              opacity: updatingId === order.id ? 0.7 : 1,
                            }}
                          >
                            {updatingId === order.id
                              ? "Updating..."
                              : primaryAction.label}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {selectedOrder ? (
        <div
          className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-detail-title"
        >
          <div
            className="order-detail-surface w-full max-w-3xl rounded-3xl p-6 max-h-[85vh] overflow-y-auto"
            style={{
              background: "var(--order-detail-bg)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 w-full max-w-[35%] flex-none">
                <p className="text-xs uppercase tracking-[0.2em] opacity-70">
                  Order details
                </p>
                <h2 id="order-detail-title" className="text-2xl font-semibold">
                  Order {selectedOrder.order_number}
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <OrderStatusBadge status={selectedOrder.status} />
                  <span className="text-xs opacity-70">
                    {formatOrderDateTime(selectedOrder.created_at)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-full p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60 focus-visible:ring-offset-2"
                aria-label="Close order details"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] opacity-60">
                  Customer
                </p>
                <p className="font-semibold">{selectedOrder.contact_name}</p>
                <p className="text-xs opacity-70">
                  {selectedOrder.contact_phone || "No phone listed"}
                </p>
                {selectedOrder.contact_email ? (
                  <p className="text-xs opacity-70">
                    {selectedOrder.contact_email}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] opacity-60">
                  Fulfillment
                </p>
                <p className="font-semibold">
                  {selectedOrder.fulfillment_type === "delivery"
                    ? "Delivery"
                    : "Pickup"}
                </p>
                {selectedOrder.fulfillment_type === "delivery" ? (
                  <p className="text-xs opacity-70">
                    {selectedOrder.delivery_address1}
                    {selectedOrder.delivery_address2
                      ? `, ${selectedOrder.delivery_address2}`
                      : ""}
                  </p>
                ) : (
                  <p className="text-xs opacity-70">
                    Pickup time: {selectedOrder.pickup_time || "ASAP"}
                  </p>
                )}
                <p className="text-xs opacity-70">
                  {getOrderStatusDescription(selectedOrder.status)}
                </p>
              </div>
            </div>

            <div
              className="mt-4 border-t pt-4"
              style={{ borderColor: "var(--border)" }}
            >
              <p className="text-sm font-semibold">Items</p>
              <div className="mt-2 text-xs uppercase tracking-[0.2em] opacity-60 grid grid-cols-[1fr_80px_110px_130px] gap-6">
                <span>Item</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Unit</span>
                <span className="text-right">Total</span>
              </div>
              <div className="mt-2 space-y-2 text-sm">
                {(selectedOrder.order_items || []).map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[1fr_80px_110px_130px] items-center gap-6"
                  >
                    <span className="opacity-80">{item.title}</span>
                    <span className="text-right">{item.quantity}</span>
                    <span className="text-right">
                      ${formatMoney(item.unit_price)}
                    </span>
                    <span className="text-right">
                      $
                      {formatMoney(
                        Number(item.unit_price || 0) * Number(item.quantity || 0)
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <span
                className="rounded-full border px-3 py-1 text-xs"
                style={{ borderColor: "var(--border)" }}
              >
                Total: ${formatMoney(selectedOrder.total)}
              </span>
              <OrderStatusBadge
                status={selectedOrder.status}
                label={getOrderStatusLabel(selectedOrder.status)}
              />
            </div>

            {orderActions.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {orderActions.map((action) => {
                  const isDestructive = action.status === "cancelled";
                  return (
                    <button
                      key={action.status}
                      type="button"
                      onClick={() =>
                        handleStatusUpdate(selectedOrder.id, action.status)
                      }
                      disabled={updatingId === selectedOrder.id}
                      className={baseButton}
                      style={{
                        background: isDestructive ? "#e11d48" : "var(--text)",
                        color: "var(--background)",
                        opacity: updatingId === selectedOrder.id ? 0.7 : 1,
                      }}
                    >
                      {updatingId === selectedOrder.id
                        ? "Updating..."
                        : action.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
