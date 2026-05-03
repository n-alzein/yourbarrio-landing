import Link from "next/link";
import {
  formatMoney,
  formatOrderPurchaseTime,
  getOrderStatusLabel,
  groupOrdersByPurchaseDate,
} from "@/lib/orders";
import { formatEntityId } from "@/lib/entityIds";
import {
  getOrderItemThumbnailUrl,
  getOrderThumbnailItems,
} from "@/lib/orders/itemThumbnails";

const getVendorName = (order) =>
  order?.vendor?.business_name || order?.vendor?.full_name || "Local vendor";

const getOrderThumbnailUrl = (order) => {
  const item = Array.isArray(order?.order_items) ? order.order_items[0] : null;
  return getOrderItemThumbnailUrl(item);
};

function MultiItemThumbnailPreview({ order }) {
  const { items, overflowCount } = getOrderThumbnailItems(order, 3);
  const lastIndex = items.length - 1;

  return (
    <div
      className="flex min-w-[9.75rem] shrink-0 items-center gap-1.5 sm:min-w-[11.25rem]"
      aria-hidden="true"
    >
      {items.map((item, index) => {
        const showOverflow = overflowCount > 0 && index === lastIndex;

        return (
          <div
            key={item.key}
            className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[10px] border border-[rgba(15,23,42,0.06)] bg-white sm:h-14 sm:w-14"
          >
            {item.url ? (
              <img
                src={item.url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="h-full w-full"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(15, 23, 42, 0.06), rgba(15, 23, 42, 0.02))",
                }}
              />
            )}
            {showOverflow ? (
              <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-xs font-semibold text-white">
                +{overflowCount}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function SubtleStatus({ status }) {
  if (!status || status === "fulfilled") return null;

  return (
    <span className="text-xs font-medium text-slate-500">
      {getOrderStatusLabel(status)}
    </span>
  );
}

export default function PurchaseHistoryList({ orders }) {
  const groups = groupOrdersByPurchaseDate(orders || []);

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.key} className="space-y-3 first:mt-0" aria-labelledby={`purchase-date-${group.key}`}>
          <div className="flex items-center gap-3">
            <h2
              id={`purchase-date-${group.key}`}
              className="text-[11px] font-medium text-slate-500"
            >
              {group.label}
            </h2>
            <div className="h-px flex-1" style={{ background: "var(--border)" }} />
          </div>

          <div>
            {group.orders.map((order) => {
              const vendorName = getVendorName(order);
              const thumbnailUrl = getOrderThumbnailUrl(order);
              const isMultiItemOrder = Array.isArray(order?.order_items) && order.order_items.length > 1;
              const displayOrderId =
                formatEntityId("order", order.order_number) || order.order_number;

              return (
                <Link
                  key={order.id}
                  href={`/orders/${order.order_number}`}
                  aria-label={`View receipt for order ${displayOrderId} from ${vendorName}`}
                  className="group flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 py-3.5 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] sm:px-5 sm:py-4"
                  style={{
                    outlineColor: "rgb(var(--brand-rgb))",
                    borderBottom:
                      group.orders[group.orders.length - 1]?.id === order.id
                        ? "none"
                        : "1px solid rgba(15, 23, 42, 0.06)",
                  }}
                >
                  <div className="min-w-0 flex flex-1 items-center gap-4 sm:gap-[1.125rem]">
                    {isMultiItemOrder ? (
                      <MultiItemThumbnailPreview order={order} />
                    ) : thumbnailUrl ? (
                        <img
                          src={thumbnailUrl}
                          alt=""
                          loading="lazy"
                          className="h-12 w-12 shrink-0 rounded-[10px] object-cover sm:h-14 sm:w-14"
                        />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="h-12 w-12 shrink-0 rounded-[10px] sm:h-14 sm:w-14"
                        style={{
                          background:
                            "linear-gradient(135deg, rgba(15, 23, 42, 0.06), rgba(15, 23, 42, 0.02))",
                          border: "1px solid rgba(15, 23, 42, 0.06)",
                        }}
                      />
                    )}

                    <div className="min-w-0 flex-1 space-y-0.5 pr-1">
                      <p className="truncate text-base font-semibold text-slate-950 sm:text-[1.05rem]">{vendorName}</p>
                      <p className="text-sm font-normal leading-5 text-slate-500">
                        {displayOrderId} · {formatOrderPurchaseTime(order)}
                      </p>
                      <SubtleStatus status={order.status} />
                    </div>
                  </div>

                  <div className="ml-2 flex min-w-[150px] shrink-0 items-center justify-end gap-2.5 self-center text-right">
                    <span className="text-base font-semibold text-slate-950">${formatMoney(order.total)}</span>
                    <span className="text-lg leading-none text-slate-500 transition-colors group-hover:text-[rgb(var(--brand-rgb))]" aria-hidden="true">
                      →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
