"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import SafeAvatar from "@/components/SafeAvatar";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getAuthedContext } from "@/lib/auth/getAuthedContext";
import { useRealtimeChannel } from "@/lib/realtime/useRealtimeChannel";
import {
  filterRealConversationMessages,
  getAvatarUrl,
  getDisplayName,
  getOtherConversationProfile,
  isRealConversationMessage,
  isSystemOrderMessage,
  markConversationRead,
  sendMessage,
} from "@/lib/messages";
import { getOrderStatusLabel } from "@/lib/orders";
import { retry } from "@/lib/retry";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import { memoizeRequest } from "@/lib/requestMemo";
import MessageThread from "@/components/messages/MessageThread";
import MessageComposer from "@/components/messages/MessageComposer";
import {
  appendMessageDedup,
  isNearScrollBottom,
  prependMessagesDedup,
  scrollToBottom,
} from "@/components/messages/realtimeThreadState";

const UNREAD_REFRESH_EVENT = "yb-unread-refresh";
const BUSINESS_THREAD_PAGE_SIZE = 40;

async function fetchBusinessMessagePage({
  conversationId,
  before,
  beforeId,
  limit = BUSINESS_THREAD_PAGE_SIZE,
}) {
  const params = new URLSearchParams({
    conversationId,
    limit: String(limit),
  });
  if (before) params.set("before", before);
  if (beforeId) params.set("beforeId", beforeId);

  const response = await retry(
    () =>
      fetchWithTimeout(`/api/business/messages?${params.toString()}`, {
        method: "GET",
        credentials: "include",
        timeoutMs: 12000,
      }),
    { retries: 1, delayMs: 600 }
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to load messages");
  }

  const payload = await response.json();
  return {
    messages: filterRealConversationMessages(payload?.messages),
    hasMore: Boolean(payload?.hasMore),
  };
}

function useDelayedFlag(active, delayMs = 200) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(active);
    }, active ? delayMs : 0);
    return () => window.clearTimeout(timer);
  }, [active, delayMs]);

  return visible;
}

export default function BusinessConversationClient({
  conversationId,
  initialConversation = null,
  initialMessages = [],
  initialHasMore = false,
  initialOrderContext = null,
  initialError = null,
  initialUserId = null,
}) {
  const { user, loadingUser, supabase, authStatus } = useAuth();
  const userId = user?.id || initialUserId || null;
  const [conversation, setConversation] = useState(initialConversation);
  const [messages, setMessages] = useState(() =>
    filterRealConversationMessages(initialMessages)
  );
  const [orderContext, setOrderContext] = useState(() =>
    normalizeBusinessOrderContext(initialOrderContext)
  );
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(Boolean(initialHasMore));
  const [error, setError] = useState(initialError);
  const [messagesError, setMessagesError] = useState(null);
  const [sendError, setSendError] = useState(null);
  const [seededHeader, setSeededHeader] = useState(null);
  const requestIdRef = useRef(0);
  const [isVisible, setIsVisible] = useState(
    typeof document === "undefined" ? true : !document.hidden
  );
  const scrollRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const shouldStickToBottomRef = useRef(true);
  const restoreScrollAfterPrependRef = useRef(null);
  const hasThreadRef = useRef(Boolean(initialConversation));
  const showThreadLoader = useDelayedFlag(loading && messages.length === 0);

  const loadThread = useCallback(async () => {
    if (!conversationId || authStatus !== "authenticated") return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    setMessagesError(null);

    try {
      const result = await memoizeRequest(
        `business-thread:${conversationId}`,
        async () => {
          const [convoResponse, messagePage] = await Promise.all([
            fetchWithTimeout(
              `/api/business/conversations?conversationId=${encodeURIComponent(
                conversationId
              )}`,
              {
                method: "GET",
                credentials: "include",
                timeoutMs: 12000,
              }
            ),
            fetchBusinessMessagePage({ conversationId }),
          ]);

          if (!convoResponse.ok) {
            const message = await convoResponse.text();
            throw new Error(message || "Failed to load conversation");
          }

          const convoPayload = await convoResponse.json();

          return {
            conversation: convoPayload?.conversation ?? null,
            orderContext: normalizeBusinessOrderContext(
              convoPayload?.orderContext ?? null
            ),
            messages: messagePage.messages,
            hasMore: messagePage.hasMore,
          };
        }
      );

      if (requestId !== requestIdRef.current) return;

      setConversation(result.conversation);
      setOrderContext(result.orderContext);
      shouldStickToBottomRef.current = true;
      setMessages(result.messages);
      setHasMore(result.hasMore);
      hasThreadRef.current = Boolean(result.conversation);
    } catch (err) {
      console.error("Failed to load conversation", err);
      if (requestId !== requestIdRef.current) return;

      if (hasThreadRef.current) {
        setMessagesError("We couldn't refresh messages yet. Try again.");
      } else {
        setError("We couldn't load this conversation. Try again soon.");
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [authStatus, conversationId]);

  const reloadMessages = useCallback(async () => {
    if (!conversationId || authStatus !== "authenticated") return;
    setMessagesError(null);

    try {
      const page = await fetchBusinessMessagePage({ conversationId });
      shouldStickToBottomRef.current = true;
      setMessages(page.messages);
      setHasMore(page.hasMore);
    } catch (err) {
      console.error("Failed to reload messages", err);
      setMessagesError("We couldn't load messages yet. Try again.");
    }
  }, [authStatus, conversationId]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const handleVisibility = () => setIsVisible(!document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    if (!conversationId || authStatus !== "authenticated") return;
    if (!isVisible && hasThreadRef.current) return;
    void loadThread();
  }, [authStatus, conversationId, isVisible, loadThread]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!conversationId) return;
    window.sessionStorage.setItem("yb-last-opened-conversation", conversationId);
  }, [conversationId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!conversationId || conversation) return;
    try {
      const raw = window.sessionStorage.getItem(
        `yb-conversation-header:${conversationId}`
      );
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      setSeededHeader({
        name:
          typeof parsed.name === "string" && parsed.name.trim()
            ? parsed.name.trim()
            : "",
        avatarUrl:
          typeof parsed.avatarUrl === "string" ? parsed.avatarUrl : "",
      });
    } catch {}
  }, [conversation, conversationId]);

  const notifyUnreadRefresh = useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent(UNREAD_REFRESH_EVENT, {
        detail: { role: "business", conversationId },
      })
    );
  }, [conversationId]);

  useEffect(() => {
    if (!userId || !conversationId) return;
    if (authStatus !== "authenticated") return;
    const client = getSupabaseBrowserClient();
    markConversationRead({
      supabase: client,
      conversationId,
    })
      .then(() => {
        notifyUnreadRefresh();
      })
      .catch((err) => {
        console.warn("Failed to mark conversation read", err);
      });
  }, [authStatus, conversationId, notifyUnreadRefresh, userId]);

  const handleThreadScroll = useCallback(() => {
    isNearBottomRef.current = isNearScrollBottom(scrollRef.current);
  }, []);

  useEffect(() => {
    if (!scrollRef.current) return;
    const restore = restoreScrollAfterPrependRef.current;
    if (restore) {
      scrollRef.current.scrollTop =
        scrollRef.current.scrollHeight - restore.scrollHeight + restore.scrollTop;
      restoreScrollAfterPrependRef.current = null;
      return;
    }
    if (loadingMore) return;
    if (!shouldStickToBottomRef.current && !isNearBottomRef.current) return;
    const handle = requestAnimationFrame(() => {
      scrollToBottom(scrollRef.current);
      shouldStickToBottomRef.current = false;
      isNearBottomRef.current = true;
    });
    return () => cancelAnimationFrame(handle);
  }, [loadingMore, messages.length]);

  const buildThreadChannel = useCallback(
    (activeClient) =>
      activeClient
        .channel(`messages-${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const next = payload.new;
      if (!next?.id) return;
            if (isSystemOrderMessage(next)) return;
            if (!isRealConversationMessage(next)) return;
            shouldStickToBottomRef.current = isNearBottomRef.current;
            setMessages((prev) => {
              return appendMessageDedup(prev, next);
            });
            if (next.recipient_id === userId) {
              markConversationRead({
                supabase: activeClient,
                conversationId,
              })
                .then(() => {
                  notifyUnreadRefresh();
                })
                .catch(() => {});
            }
          }
        ),
    [conversationId, notifyUnreadRefresh, userId]
  );

  useRealtimeChannel({
    supabase,
    enabled:
      !loadingUser &&
      authStatus === "authenticated" &&
      Boolean(conversationId),
    buildChannel: buildThreadChannel,
    diagLabel: "business-thread",
  });

  const loadOlder = useCallback(async () => {
    if (!conversationId || loadingMore || !hasMore) return;
    if (authStatus !== "authenticated") return;
    const oldestMessage = messages[0];
    if (!oldestMessage?.created_at) return;

    if (scrollRef.current) {
      restoreScrollAfterPrependRef.current = {
        scrollHeight: scrollRef.current.scrollHeight,
        scrollTop: scrollRef.current.scrollTop,
      };
    }
    setLoadingMore(true);
    try {
      const page = await fetchBusinessMessagePage({
        conversationId,
        before: oldestMessage.created_at,
        beforeId: oldestMessage.id || null,
      });
      const older = page.messages;
      if (older.length === 0) {
        setHasMore(false);
        restoreScrollAfterPrependRef.current = null;
      } else {
        shouldStickToBottomRef.current = false;
        setMessages((prev) => prependMessagesDedup(prev, older));
        setHasMore(page.hasMore);
      }
    } catch (err) {
      restoreScrollAfterPrependRef.current = null;
      console.error("Failed to load older messages", err);
    } finally {
      setLoadingMore(false);
    }
  }, [authStatus, conversationId, hasMore, loadingMore, messages]);

  const handleSend = useCallback(
    async (body) => {
      if (!conversation) {
        setSendError("Conversation unavailable.");
        return;
      }
      setSendError(null);
      try {
        const { client, session, userId: authedUserId } = await getAuthedContext(
          "sendMessage"
        );
        const recipientId =
          conversation.customer_id === authedUserId
            ? conversation.business_id
            : conversation.customer_id;
        if (!recipientId || recipientId === authedUserId) {
          throw new Error("Message recipient unavailable");
        }
        const sent = await sendMessage({
          supabase: client,
          conversationId: conversation.id,
          recipientId,
          body,
          session,
        });
        if (sent?.id && isRealConversationMessage(sent)) {
          shouldStickToBottomRef.current = true;
          setMessages((prev) => {
            return appendMessageDedup(prev, sent);
          });
        }
      } catch (err) {
        console.error("Message send failed", err);
        setSendError(err?.message || "Message failed to send.");
      }
    },
    [conversation]
  );

  const otherProfile = useMemo(
    () =>
      getOtherConversationProfile({
        conversation,
        currentUserId: userId,
      }),
    [conversation, userId]
  );

  const headerName =
    (otherProfile ? getDisplayName(otherProfile) : "") ||
    seededHeader?.name ||
    "";
  const headerAvatarUrl = otherProfile
    ? getAvatarUrl(otherProfile)
    : seededHeader?.avatarUrl || "";

  return (
    <section
      className="relative w-full overflow-hidden bg-[#f6f7fb] text-slate-950"
      style={{
        boxSizing: "border-box",
        height:
          "calc(100dvh - var(--yb-nav-content-offset, 80px) - var(--business-beta-banner-height, 0px))",
      }}
    >
      <div className="box-border flex h-full min-h-0 w-full px-2 pb-2 sm:px-5 sm:pb-4 md:px-8 md:pb-5 lg:px-12">
        <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-[22px] border border-slate-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.045)] sm:rounded-[28px]">
          <div className="shrink-0 border-b border-slate-100 bg-white px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="space-y-2">
          <Link
            href="/business/messages"
                className="inline-flex items-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 transition hover:text-slate-700"
          >
            Back to inbox
          </Link>
              <div className="flex items-center gap-3">
            {otherProfile || seededHeader ? (
              <SafeAvatar
                src={headerAvatarUrl}
                name={headerName}
                alt={headerName}
                    className="h-10 w-10 rounded-full border border-slate-100 object-cover sm:h-11 sm:w-11"
                initialsClassName="text-[13px]"
                iconClassName="h-5 w-5"
              />
            ) : (
                  <div className="h-10 w-10 animate-pulse rounded-full border border-slate-100 bg-slate-100 sm:h-11 sm:w-11" />
            )}
                <div className="min-w-0">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Conversation
              </p>
              {otherProfile || seededHeader ? (
                    <h1 className="truncate text-base font-semibold text-slate-950">
                      {headerName}
                    </h1>
              ) : (
                    <div className="mt-2 h-5 w-36 animate-pulse rounded-full bg-slate-100" />
              )}
                </div>
              </div>
            </div>
          </div>

      {error ? (
            <div className="mx-4 mt-3 shrink-0 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              void loadThread();
            }}
                className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700 transition hover:bg-rose-100"
          >
            Try again
          </button>
        </div>
      ) : null}

          <div className="flex min-h-0 flex-1 flex-col bg-white">
        {messagesError ? (
              <div className="mx-4 mt-3 shrink-0 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span>{messagesError}</span>
            <button
              type="button"
              onClick={() => {
                void reloadMessages();
              }}
                  className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700 transition hover:bg-rose-100"
            >
              Retry
            </button>
          </div>
        ) : null}

            {orderContext ? <OrderContextCard order={orderContext} /> : null}

            <div className="flex min-h-0 flex-1 flex-col">
          <div
                className="min-h-0 flex-1 overflow-y-auto bg-slate-50/45 px-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 sm:px-4 sm:pb-6 sm:pt-4"
            ref={scrollRef}
            onScroll={handleThreadScroll}
          >
            {hasMore ? (
              <div className="mb-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    void loadOlder();
                  }}
                  disabled={loadingMore}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-500 shadow-sm transition hover:border-violet-100 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-60"
                >
                  {loadingMore ? "Loading..." : "Load earlier messages"}
                </button>
              </div>
            ) : null}
                {showThreadLoader ? (
                  <div className="py-8 text-center text-sm text-slate-500">
                    Loading messages...
                  </div>
                ) : (
                  <MessageThread
                    messages={messages}
                    currentUserId={userId}
                    variant="light"
                  />
                )}
          </div>
        </div>
      </div>

          <div className="shrink-0 border-t border-slate-100 bg-white px-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2.5 sm:p-3">
        {sendError ? (
              <div className="mb-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            {sendError}
          </div>
        ) : null}
            <MessageComposer
              onSend={handleSend}
              disabled={loading || !conversation}
              variant="light"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function normalizeBusinessOrderContext(order) {
  if (!order) return null;
  const orderNumber = order.orderNumber || order.orderId || "";
  return {
    ...order,
    viewHref: orderNumber
      ? `/business/orders?order=${encodeURIComponent(orderNumber)}`
      : "/business/orders",
  };
}

function formatContextTime(value) {
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

function OrderContextCard({ order }) {
  const orderNumber = order?.orderNumber || order?.orderId || "";
  const statusLabel = getOrderStatusLabel(order?.status);
  const updatedLabel = formatContextTime(order?.updatedAt);
  const href = order?.viewHref || "/business/orders";

  return (
    <aside className="mx-3 mt-2 shrink-0 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 sm:mx-4 sm:mt-3 sm:px-4 sm:py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Order context
          </p>
          <p className="mt-1 truncate font-semibold text-slate-950">
            Order {orderNumber}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {statusLabel}
            {order?.fulfillmentLabel ? ` · ${order.fulfillmentLabel}` : ""}
            {updatedLabel ? ` · ${updatedLabel}` : ""}
          </p>
        </div>
        <Link
          href={href}
          className="yb-primary-button inline-flex h-8 shrink-0 items-center justify-center rounded-full px-3 text-xs font-semibold !text-white sm:h-9 sm:px-4"
        >
          View order
        </Link>
      </div>
    </aside>
  );
}
