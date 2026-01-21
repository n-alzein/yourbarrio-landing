"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, X } from "lucide-react";

const TABS = [
  { id: "new", label: "New" },
  { id: "progress", label: "In progress" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

const statusStyles = {
  requested: "bg-amber-500/20 text-amber-200 border-amber-500/40",
  confirmed: "bg-sky-500/20 text-sky-200 border-sky-500/40",
  ready: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  out_for_delivery: "bg-purple-500/20 text-purple-200 border-purple-500/40",
  fulfilled: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  cancelled: "bg-rose-500/20 text-rose-200 border-rose-500/40",
};

const statusLabels = {
  requested: "Requested",
  confirmed: "Confirmed",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

const formatMoney = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function BusinessOrdersClient() {
  const searchParams = useSearchParams();
  const initialTab = searchParams?.get("tab") || "new";
  const [activeTab, setActiveTab] = useState(
    TABS.some((tab) => tab.id === initialTab) ? initialTab : "new"
  );
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

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
    loadOrders(activeTab);
  }, [activeTab]);

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
        prev.map((order) =>
          order.id === orderId ? { ...order, ...payload.order } : order
        )
      );
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => ({ ...prev, ...payload.order }));
      }
    } catch (err) {
      setError(err?.message || "Failed to update order");
    } finally {
      setUpdatingId(null);
    }
  };

  const orderActions = useMemo(() => {
    if (!selectedOrder) return [];
    const actions = [];
    if (selectedOrder.status === "requested") {
      actions.push({ label: "Confirm", status: "confirmed" });
      actions.push({ label: "Cancel", status: "cancelled" });
    }
    if (selectedOrder.status === "confirmed") {
      actions.push({ label: "Mark ready", status: "ready" });
      actions.push({ label: "Cancel", status: "cancelled" });
    }
    if (selectedOrder.status === "ready") {
      if (selectedOrder.fulfillment_type === "delivery") {
        actions.push({ label: "Out for delivery", status: "out_for_delivery" });
      }
      actions.push({ label: "Mark fulfilled", status: "fulfilled" });
    }
    if (selectedOrder.status === "out_for_delivery") {
      actions.push({ label: "Mark fulfilled", status: "fulfilled" });
    }
    return actions;
  }, [selectedOrder]);

  return (
    <div className="min-h-screen px-4 md:px-8 lg:px-12 py-12" style={{ background: "var(--background)", color: "var(--text)" }}>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] opacity-70">Orders</p>
          <h1 className="text-3xl font-semibold">Manage orders</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="rounded-full px-4 py-2 text-sm font-semibold"
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

        {error ? (
          <div className="rounded-2xl p-4 text-sm text-rose-200" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-3xl p-10 flex items-center gap-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading orders...
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-3xl p-8 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <h2 className="text-xl font-semibold">No orders in this view</h2>
            <p className="mt-2 text-sm opacity-80">New orders will show up here when customers submit requests.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const statusStyle = statusStyles[order.status] || "bg-white/10 text-white border-white/20";
              const statusLabel = statusLabels[order.status] || order.status;
              const schedule =
                order.fulfillment_type === "delivery"
                  ? order.delivery_time
                  : order.pickup_time;
              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrder(order)}
                  className="w-full rounded-3xl p-5 text-left flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Order {order.order_number}</p>
                    <p className="text-xs opacity-70">{order.contact_name}</p>
                    <p className="text-xs opacity-70">
                      {new Date(order.created_at).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: "var(--border)" }}>
                      {order.fulfillment_type === "delivery" ? "Delivery" : "Pickup"}
                    </span>
                    {schedule ? (
                      <span className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: "var(--border)" }}>
                        {schedule}
                      </span>
                    ) : null}
                    <span className={`rounded-full border px-3 py-1 text-xs ${statusStyle}`}>
                      {statusLabel}
                    </span>
                    <span className="text-sm font-semibold">${formatMoney(order.total)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedOrder ? (
        <div className="fixed inset-0 z-[6000] flex items-end justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-3xl rounded-3xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] opacity-70">Order details</p>
                <h2 className="text-2xl font-semibold">Order {selectedOrder.order_number}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-full p-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] opacity-60">Customer</p>
                <p className="font-semibold">{selectedOrder.contact_name}</p>
                <p className="text-xs opacity-70">{selectedOrder.contact_phone}</p>
                {selectedOrder.contact_email ? (
                  <p className="text-xs opacity-70">{selectedOrder.contact_email}</p>
                ) : null}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] opacity-60">Fulfillment</p>
                <p className="font-semibold">
                  {selectedOrder.fulfillment_type === "delivery" ? "Delivery" : "Pickup"}
                </p>
                {selectedOrder.fulfillment_type === "delivery" ? (
                  <p className="text-xs opacity-70">
                    {selectedOrder.delivery_address1}
                    {selectedOrder.delivery_address2 ? `, ${selectedOrder.delivery_address2}` : ""}
                  </p>
                ) : (
                  <p className="text-xs opacity-70">Pickup time: {selectedOrder.pickup_time || "ASAP"}</p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm font-semibold">Items</p>
              <div className="mt-2 space-y-2 text-sm">
                {(selectedOrder.order_items || []).map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <span className="opacity-80">{item.title} x{item.quantity}</span>
                    <span>${formatMoney(Number(item.unit_price || 0) * Number(item.quantity || 0))}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: "var(--border)" }}>
                Total: ${formatMoney(selectedOrder.total)}
              </span>
              <span className={`rounded-full border px-3 py-1 text-xs ${statusStyles[selectedOrder.status] || "bg-white/10 text-white border-white/20"}`}>
                {statusLabels[selectedOrder.status] || selectedOrder.status}
              </span>
            </div>

            {orderActions.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {orderActions.map((action) => (
                  <button
                    key={action.status}
                    type="button"
                    onClick={() => handleStatusUpdate(selectedOrder.id, action.status)}
                    disabled={updatingId === selectedOrder.id}
                    className="rounded-full px-4 py-2 text-xs font-semibold"
                    style={{ background: "var(--text)", color: "var(--background)", opacity: updatingId === selectedOrder.id ? 0.7 : 1 }}
                  >
                    {updatingId === selectedOrder.id ? "Updating..." : action.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
