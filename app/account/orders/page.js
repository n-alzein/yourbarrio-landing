import Link from "next/link";
import { requireRole } from "@/lib/auth/server";

const PENDING_STATUSES = ["requested", "confirmed", "ready", "out_for_delivery"];

const formatMoney = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const statusStyles = {
  requested: "bg-amber-500/20 text-amber-200 border-amber-500/40",
  confirmed: "bg-sky-500/20 text-sky-200 border-sky-500/40",
  ready: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  out_for_delivery: "bg-purple-500/20 text-purple-200 border-purple-500/40",
  fulfilled: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  cancelled: "bg-rose-500/20 text-rose-200 border-rose-500/40",
  completed: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
};

const statusLabels = {
  requested: "Requested",
  confirmed: "Confirmed",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
  completed: "Completed",
};

export default async function AccountOrdersPage({ searchParams }) {
  const { supabase, user } = await requireRole("customer");
  const resolvedParams =
    searchParams && typeof searchParams.then === "function"
      ? await searchParams
      : searchParams;
  const page = Math.max(Number(resolvedParams?.page || 1), 1);
  const limit = 8;
  const from = (page - 1) * limit;
  const to = from + limit;

  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      "id,order_number,created_at,status,fulfillment_type,total, vendor:users!orders_vendor_id_fkey (business_name, full_name)"
    )
    .eq("user_id", user.id)
    .in("status", PENDING_STATUSES)
    .order("created_at", { ascending: false })
    .range(from, to);

  const rows = orders || [];
  const hasMore = rows.length > limit;
  const visibleRows = hasMore ? rows.slice(0, limit) : rows;

  return (
    <div className="min-h-screen px-4 md:px-8 lg:px-12 py-12" style={{ background: "var(--background)", color: "var(--text)" }}>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] opacity-70">Orders</p>
          <h1 className="text-3xl font-semibold">My Orders</h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/account/orders"
            className="rounded-full px-4 py-2 text-sm font-semibold"
            style={{ background: "var(--text)", color: "var(--background)" }}
          >
            Pending
          </Link>
          <Link
            href="/account/purchase-history"
            className="rounded-full border px-4 py-2 text-sm font-semibold"
            style={{ borderColor: "var(--border)" }}
          >
            History
          </Link>
        </div>

        {error ? (
          <div className="rounded-2xl p-4 text-sm text-rose-200" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {error.message || "Failed to load orders."}
          </div>
        ) : null}

        {visibleRows.length === 0 ? (
          <div className="rounded-3xl p-8 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <h2 className="text-xl font-semibold">No pending orders</h2>
            <p className="mt-2 text-sm opacity-80">Browse the marketplace to start a new order.</p>
            <Link
              href="/customer/home"
              className="mt-5 inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold"
              style={{ background: "var(--text)", color: "var(--background)" }}
            >
              Back to marketplace
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleRows.map((order) => {
              const vendorName =
                order?.vendor?.business_name ||
                order?.vendor?.full_name ||
                "Local vendor";
              const statusLabel = statusLabels[order.status] || order.status;
              const statusStyle = statusStyles[order.status] || "bg-white/10 text-white border-white/20";
              return (
                <div
                  key={order.id}
                  className="rounded-3xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Order {order.order_number}</p>
                    <p className="text-xs opacity-70">{vendorName}</p>
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
                    <span className={`rounded-full border px-3 py-1 text-xs ${statusStyle}`}>
                      {statusLabel}
                    </span>
                    <span className="text-sm font-semibold">${formatMoney(order.total)}</span>
                    <Link
                      href={`/orders/${order.order_number}`}
                      className="rounded-full px-4 py-2 text-xs font-semibold"
                      style={{ background: "var(--text)", color: "var(--background)" }}
                    >
                      View
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasMore ? (
          <div className="flex justify-center">
            <Link
              href={`/account/orders?page=${page + 1}`}
              className="rounded-full border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: "var(--border)" }}
            >
              Load more
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
