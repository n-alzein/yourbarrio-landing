"use client";

import OrderCard from "@/components/messages/OrderCard";

function formatMessageTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function normalizeOrderItems(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      name: item.name || item.title || "",
      image_url: item.image_url || item.photo_url || "",
    }));
}

function getOrderMessageKey(message) {
  if (message?.type !== "order_status_update") return null;
  return message.order_id || message.order_number || null;
}

function buildOrderCards(messages = [], currentUserId) {
  const cards = new Map();
  messages.forEach((message) => {
    const key = getOrderMessageKey(message);
    if (!key) return;
    const existing =
      cards.get(key) ||
      {
        orderId: message.order_id || key,
        orderNumber: message.order_number || "",
        businessName: message.business_name || "",
        items: normalizeOrderItems(message.order_items),
        statusHistory: [],
        updatedAt: message.timestamp || message.created_at || null,
        fulfillmentType: message.fulfillment_type || null,
        senderId: message.sender_id || null,
      };
    const status = String(message.status || "").trim();
    if (status && !existing.statusHistory.includes(status)) {
      existing.statusHistory.push(status);
    }
    existing.orderNumber = existing.orderNumber || message.order_number || "";
    existing.businessName = existing.businessName || message.business_name || "";
    existing.fulfillmentType =
      existing.fulfillmentType || message.fulfillment_type || null;
    const nextItems = normalizeOrderItems(message.order_items);
    if (!existing.items.length && nextItems.length) existing.items = nextItems;
    existing.updatedAt = message.timestamp || message.created_at || existing.updatedAt;
    existing.viewHref =
      existing.senderId && existing.senderId === currentUserId
        ? `/business/orders?order=${encodeURIComponent(existing.orderNumber || "")}`
        : existing.orderNumber
          ? `/orders/${encodeURIComponent(existing.orderNumber)}`
          : "/account/orders";
    cards.set(key, existing);
  });
  return cards;
}

function buildThreadEntries(messages = [], currentUserId) {
  const orderCards = buildOrderCards(messages, currentUserId);
  const renderedOrderKeys = new Set();
  const entries = [];

  messages.forEach((message) => {
    const orderKey = getOrderMessageKey(message);
    if (orderKey) {
      if (renderedOrderKeys.has(orderKey)) return;
      const card = orderCards.get(orderKey);
      if (card) {
        entries.push({
          type: "order-card",
          key: `order-${orderKey}`,
          card,
        });
        renderedOrderKeys.add(orderKey);
      }
      return;
    }

    const last = entries[entries.length - 1];
    if (
      last?.type === "messages" &&
      last.sender_id === message.sender_id
    ) {
      last.items.push(message);
    } else {
      entries.push({
        type: "messages",
        key: `messages-${message.sender_id || "unknown"}-${entries.length}`,
        sender_id: message.sender_id,
        items: [message],
      });
    }
  });

  return entries;
}

export default function MessageThread({
  messages = [],
  currentUserId,
  loading = false,
}) {
  if (loading && !messages.length) {
    return (
      <div className="space-y-5">
        {Array.from({ length: 5 }).map((_, index) => {
          const isSelf = index % 2 === 0;
          return (
            <div
              key={index}
              className={`flex ${isSelf ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[80%] ${isSelf ? "items-end" : "items-start"}`}>
                <div
                  className={`rounded-[24px] border px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${
                    isSelf
                      ? "border-[#dccbff]/30 bg-[linear-gradient(135deg,rgba(220,203,255,0.28),rgba(220,203,255,0.14))]"
                      : "border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.14),rgba(255,255,255,0.06))]"
                  }`}
                >
                  <div className="animate-pulse">
                    <div className="h-4 w-40 rounded-full bg-white/15" />
                    <div className="mt-2 h-4 w-28 rounded-full bg-white/10" />
                    {index === 2 ? (
                      <div className="mt-2 h-4 w-36 rounded-full bg-white/10" />
                    ) : null}
                  </div>
                </div>
                <div
                  className={`mt-2 h-3 rounded-full bg-white/10 animate-pulse ${
                    isSelf ? "ml-auto w-14" : "w-16"
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (!messages.length) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
        No messages yet. Start the conversation below.
      </div>
    );
  }

  const entries = buildThreadEntries(messages, currentUserId);

  return (
    <div className="space-y-4">
      {entries.map((entry, idx) => {
        if (entry.type === "order-card") {
          return (
            <div key={entry.key} className="flex justify-start">
              <OrderCard {...entry.card} />
            </div>
          );
        }

        const group = entry;
        const isSelf = group.sender_id === currentUserId;
        return (
          <div
            key={group.key || `${group.sender_id}-${idx}`}
            className={`flex ${isSelf ? "justify-end" : "justify-start"}`}
          >
            <div className={`max-w-[80%] flex flex-col ${isSelf ? "items-end" : "items-start"}`}>
              <div className="flex flex-col gap-2">
                {group.items.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                      isSelf
                        ? "text-slate-900"
                        : "text-slate-900"
                    }`}
                    style={{ backgroundColor: isSelf ? "#dccbff" : "#e5e7eb" }}
                  >
                    {message.body}
                  </div>
                ))}
              </div>
              <span className="mt-1 text-[11px] text-white/50">
                {formatMessageTime(group.items[group.items.length - 1]?.created_at)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
