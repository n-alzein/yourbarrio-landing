import Image from "next/image";
import { getOrderThumbnailItems } from "@/lib/orders/itemThumbnails";

function ThumbnailFrame({ item }) {
  const className = "h-12 w-12 shrink-0 rounded-[10px] object-cover";

  if (item.url) {
    return (
      <Image
        src={item.url}
        alt=""
        width={48}
        height={48}
        sizes="48px"
        loading="lazy"
        className={className}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className="h-12 w-12 shrink-0 rounded-[10px]"
      style={{
        background:
          "linear-gradient(135deg, rgba(15, 23, 42, 0.06), rgba(15, 23, 42, 0.02))",
        border: "1px solid rgba(15, 23, 42, 0.06)",
      }}
    />
  );
}

export default function OrderItemThumbnails({ order }) {
  const { items, overflowCount } = getOrderThumbnailItems(order);

  return (
    <div className="flex items-center gap-1.5" aria-label="Order item previews">
      {items.map((item) => (
        <ThumbnailFrame key={item.key} item={item} />
      ))}
      {overflowCount > 0 ? (
        <span
          className="inline-flex h-12 min-w-12 items-center justify-center rounded-[10px] px-2 text-xs font-semibold"
          style={{
            background: "rgba(15, 23, 42, 0.05)",
            border: "1px solid rgba(15, 23, 42, 0.08)",
            color: "var(--text)",
          }}
        >
          +{overflowCount} items
        </span>
      ) : null}
    </div>
  );
}
