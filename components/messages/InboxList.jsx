"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import SafeAvatar from "@/components/SafeAvatar";
import { getAvatarUrl, getDisplayName, getUnreadCount } from "@/lib/messages";
import {
  formatLegacyOrderUpdatePreview,
  splitInboxConversations,
} from "@/components/messages/inboxPresentation";

function formatPreviewTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function InboxList({
  conversations = [],
  role,
  basePath,
  loading,
  variant = "default",
}) {
  const router = useRouter();
  const isCustomerFlat = variant === "customer-flat";
  const isBusinessFlat = variant === "business-flat";
  const isFlat = isCustomerFlat || isBusinessFlat;

  const prefetchConversation = (conversationId) => {
    if (!conversationId) return;
    router.prefetch(`${basePath}/${conversationId}`);
  };

  const primeConversationIdentity = (conversation) => {
    if (typeof window === "undefined" || !conversation?.id) return;
    const otherProfile =
      role === "business" ? conversation.customer : conversation.business;
    const payload = {
      name: getDisplayName(otherProfile),
      avatarUrl: getAvatarUrl(otherProfile),
    };
    window.sessionStorage.setItem(
      `yb-conversation-header:${conversation.id}`,
      JSON.stringify(payload)
    );
  };

  if (loading) {
    if (isFlat) {
      return (
        <div className="divide-y divide-slate-200/80 border-y border-slate-200/80">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 px-1 py-4">
              <div className="h-11 w-11 rounded-2xl bg-slate-200" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="h-4 w-36 rounded-full bg-slate-200" />
                  <div className="h-3 w-20 rounded-full bg-slate-200" />
                </div>
                <div className="mt-3 h-3 w-2/3 rounded-full bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="rounded-[28px] border border-white/10 bg-white/5 p-1.5 md:p-2">
        <div className="space-y-2 p-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-[24px] border border-white/5 bg-white/5 px-4 py-3 md:px-5 md:py-4"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-white/10" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="h-4 w-36 rounded-full bg-white/10" />
                    <div className="h-3 w-20 rounded-full bg-white/10" />
                  </div>
                  <div className="mt-3 h-3 w-2/3 rounded-full bg-white/10" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!conversations.length && !isFlat) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
        No conversations yet.
      </div>
    );
  }

  if (isFlat) {
    const { conversations: conversationRows, orderUpdates } =
      splitInboxConversations(conversations);
    const hasConversationRows = conversationRows.length > 0;

    return (
      <div className={hasConversationRows ? "space-y-8" : "space-y-5"}>
        <InboxSection
          title="Conversations"
          emptyState={
            <EmptyInboxState
              role={isBusinessFlat ? "business" : "customer"}
              showOrdersCTA={isCustomerFlat}
            />
          }
          hideTitleWhenEmpty
        >
          {conversationRows.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              role={role}
              basePath={basePath}
              onPrepare={primeConversationIdentity}
              onPrefetch={prefetchConversation}
            />
          ))}
        </InboxSection>

        {orderUpdates.length ? (
          <InboxSection
            title={hasConversationRows ? "Order updates" : "Recent order updates"}
          >
            {orderUpdates.map((conversation) => (
              <LegacyUpdateRow
                key={conversation.id}
                conversation={conversation}
                role={role}
                basePath={basePath}
                onPrepare={primeConversationIdentity}
                onPrefetch={prefetchConversation}
              />
            ))}
          </InboxSection>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-1.5 md:p-2">
      <div className="space-y-2">
        {conversations.map((conversation) => {
          const otherProfile =
            role === "business" ? conversation.customer : conversation.business;
          const displayName = getDisplayName(otherProfile);
          const unreadCount = getUnreadCount(conversation, role);
          const preview = conversation.last_message_preview || "";
          const previewTime = formatPreviewTime(conversation.last_message_at);

          return (
            <Link
              key={conversation.id}
              href={`${basePath}/${conversation.id}`}
              prefetch
              onMouseEnter={() => {
                prefetchConversation(conversation.id);
                primeConversationIdentity(conversation);
              }}
              onFocus={() => {
                prefetchConversation(conversation.id);
                primeConversationIdentity(conversation);
              }}
              onMouseDown={() => {
                prefetchConversation(conversation.id);
                primeConversationIdentity(conversation);
              }}
              onTouchStart={() => {
                prefetchConversation(conversation.id);
                primeConversationIdentity(conversation);
              }}
              className="group block rounded-[24px] border border-transparent bg-white/0 px-4 py-3 transition hover:border-white/10 hover:bg-white/10 md:px-5 md:py-4"
            >
              <div className="flex items-center gap-4">
                <SafeAvatar
                  src={getAvatarUrl(otherProfile)}
                  name={displayName}
                  alt={displayName}
                  className="h-12 w-12 rounded-2xl object-cover border border-white/10"
                  initialsClassName="text-[13px]"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white/90 truncate">
                      {displayName}
                    </p>
                    <span className="text-xs text-white/50">{previewTime}</span>
                  </div>
                  <p className="text-xs text-white/60 truncate">{preview}</p>
                </div>
                {unreadCount > 0 ? (
                  <span className="min-w-[26px] rounded-full bg-rose-500/90 px-2 py-0.5 text-center text-[10px] font-semibold text-white">
                    {unreadCount}
                  </span>
                ) : (
                  <span className="h-2 w-2 rounded-full bg-white/20 opacity-0 transition group-hover:opacity-100" />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function InboxSection({
  title,
  emptyState = null,
  hideTitleWhenEmpty = false,
  children,
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  const isEmpty = Array.isArray(items) ? items.length === 0 : !items;
  const shouldShowTitle = !(isEmpty && hideTitleWhenEmpty);

  return (
    <section>
      {shouldShowTitle ? (
        <h2 className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          {title}
        </h2>
      ) : null}
      <div className="divide-y divide-slate-200/80 border-y border-slate-200/80">
        {isEmpty ? (
          emptyState
        ) : (
          items
        )}
      </div>
    </section>
  );
}

function EmptyInboxState({ role = "customer", showOrdersCTA = false }) {
  const isBusiness = role === "business";
  const title = isBusiness ? "No messages yet" : "Message a business";
  const description = isBusiness
    ? "When customers message your business, conversations will appear here."
    : "Browse listings or visit a business profile to ask questions, confirm details, or check availability.";
  const hint = isBusiness
    ? "Customers can contact you directly from your listings."
    : "";

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-8 text-center sm:py-10">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50 text-purple-600 ring-1 ring-purple-100">
        <MessageCircle className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        {description}
      </p>
      {hint ? (
        <p className="mt-1 text-sm leading-6 text-slate-400">{hint}</p>
      ) : null}
      {!isBusiness ? (
        <div className="mt-5 flex w-full flex-col items-stretch justify-center gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Link
            href="/listings"
            className="inline-flex items-center justify-center rounded-full bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            Browse listings
          </Link>
          {showOrdersCTA ? (
            <Link
              href="/account/purchase-history"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
            >
              View your orders
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function buildRowHandlers({ conversation, onPrepare, onPrefetch }) {
  return {
    onMouseEnter: () => {
      onPrefetch(conversation.id);
      onPrepare(conversation);
    },
    onFocus: () => {
      onPrefetch(conversation.id);
      onPrepare(conversation);
    },
    onMouseDown: () => {
      onPrefetch(conversation.id);
      onPrepare(conversation);
    },
    onTouchStart: () => {
      onPrefetch(conversation.id);
      onPrepare(conversation);
    },
  };
}

function ConversationRow({
  conversation,
  role,
  basePath,
  onPrepare,
  onPrefetch,
}) {
  const otherProfile =
    role === "business" ? conversation.customer : conversation.business;
  const displayName = getDisplayName(otherProfile);
  const unreadCount = getUnreadCount(conversation, role);
  const preview = conversation.last_message_preview || "";
  const previewTime = formatPreviewTime(conversation.last_message_at);

  return (
    <Link
      href={`${basePath}/${conversation.id}`}
      prefetch
      {...buildRowHandlers({ conversation, onPrepare, onPrefetch })}
      className="group flex cursor-pointer items-center gap-4 px-1 py-4 transition hover:bg-slate-50 sm:px-2"
    >
      <SafeAvatar
        src={getAvatarUrl(otherProfile)}
        name={displayName}
        alt={displayName}
        className="h-11 w-11 rounded-2xl border border-slate-200 object-cover shadow-sm"
        initialsClassName="text-[13px]"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-4">
          <p className="truncate text-sm font-semibold text-slate-950">
            {displayName}
          </p>
          <span className="shrink-0 pt-0.5 text-[11px] text-slate-400">
            {previewTime}
          </span>
        </div>
        <p className="mt-0.5 truncate text-sm text-slate-500">{preview}</p>
      </div>
      {unreadCount > 0 ? (
        <span className="min-w-[24px] rounded-full bg-rose-500 px-2 py-0.5 text-center text-[10px] font-semibold text-white">
          {unreadCount}
        </span>
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300 opacity-0 transition group-hover:opacity-100" />
      )}
    </Link>
  );
}

function LegacyUpdateRow({
  conversation,
  role,
  basePath,
  onPrepare,
  onPrefetch,
}) {
  const otherProfile =
    role === "business" ? conversation.customer : conversation.business;
  const displayName = getDisplayName(otherProfile);
  const unreadCount = getUnreadCount(conversation, role);
  const preview = formatLegacyOrderUpdatePreview(
    conversation.last_message_preview || ""
  );
  const previewTime = formatPreviewTime(conversation.last_message_at);

  return (
    <Link
      href={`${basePath}/${conversation.id}`}
      prefetch
      {...buildRowHandlers({ conversation, onPrepare, onPrefetch })}
      className="group flex cursor-pointer items-center gap-3 px-1 py-2.5 text-sm transition hover:bg-slate-50 sm:px-2"
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
      <p className="min-w-0 flex-1 truncate text-slate-500">
        <span className="font-medium text-slate-600">{displayName}</span>
        <span className="px-1.5 text-slate-300">&middot;</span>
        <span>{preview}</span>
      </p>
      <span className="shrink-0 text-[11px] text-slate-400">{previewTime}</span>
      {unreadCount > 0 ? (
        <span className="min-w-[22px] rounded-full bg-slate-200 px-1.5 py-0.5 text-center text-[10px] font-semibold text-slate-600">
          {unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
