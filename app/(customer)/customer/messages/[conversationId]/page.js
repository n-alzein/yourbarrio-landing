"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useRealtimeChannel } from "@/lib/realtime/useRealtimeChannel";
import {
  filterRealConversationMessages,
  getDisplayName,
  isRealConversationMessage,
  isSystemOrderMessage,
  markConversationRead,
} from "@/lib/messages";
import { getOrderStatusLabel } from "@/lib/orders";
import { getBusinessPublicUrl } from "@/lib/ids/publicRefs";
import { createFetchSafe } from "@/lib/fetchSafe";
import { memoizeRequest } from "@/lib/requestMemo";
import BusinessAvatar from "@/components/messages/BusinessAvatar";
import MessageThread from "@/components/messages/MessageThread";
import MessageComposer from "@/components/messages/MessageComposer";
import {
  fetchCustomerMessagePage,
  fetchCustomerConversationThread,
  sendCustomerConversationReply,
} from "@/components/messages/customerConversationThread";
import {
  appendMessageDedup,
  isNearScrollBottom,
  prependMessagesDedup,
  scrollToBottom,
} from "@/components/messages/realtimeThreadState";

const UNREAD_REFRESH_EVENT = "yb-unread-refresh";

function readCachedConversation(conversationId) {
  if (typeof window === "undefined" || !conversationId) return null;
  try {
    const raw =
      window.sessionStorage.getItem(`yb-conversation:${conversationId}`) ||
      window.sessionStorage.getItem(`yb-conversation-header:${conversationId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.conversation || parsed || null;
  } catch {
    return null;
  }
}

function readCachedThread(conversationId) {
  if (typeof window === "undefined" || !conversationId) return null;
  try {
    const raw = window.sessionStorage.getItem(`yb-thread:${conversationId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedThread(conversationId, payload) {
  if (typeof window === "undefined" || !conversationId) return;
  try {
    window.sessionStorage.setItem(
      `yb-thread:${conversationId}`,
      JSON.stringify({
        ...payload,
        messages: filterRealConversationMessages(payload?.messages),
        cachedAt: Date.now(),
      })
    );
  } catch {
    // Ignore storage pressure; the network path remains authoritative.
  }
}

export default function CustomerConversationPage() {
  const params = useParams();
  const conversationId = params?.conversationId;
  const { user, loadingUser, supabase, authStatus } = useAuth();
  const userId = user?.id || null;
  const conversationKey = useMemo(() => {
    if (Array.isArray(conversationId)) return conversationId[0] || "";
    return typeof conversationId === "string" ? conversationId : "";
  }, [conversationId]);

  const [hydrated, setHydrated] = useState(false);
  const initialThread = useMemo(
    () => readCachedThread(conversationKey),
    [conversationKey]
  );
  const initialConversation = useMemo(
    () =>
      initialThread?.conversation ||
      readCachedConversation(conversationKey) ||
      null,
    [conversationKey, initialThread]
  );

  const [conversation, setConversation] = useState(initialConversation);
  const [messages, setMessages] = useState(() =>
    filterRealConversationMessages(initialThread?.messages || [])
  );
  const [orderContext, setOrderContext] = useState(
    initialThread?.orderContext || null
  );
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(Boolean(initialThread?.hasMore));
  const [error, setError] = useState(null);
  const [sendError, setSendError] = useState(null);
  const [isVisible, setIsVisible] = useState(
    typeof document === "undefined" ? true : !document.hidden
  );
  const requestIdRef = useRef(0);
  const inflightRef = useRef(null);
  const loadOlderRequestIdRef = useRef(0);
  const scrollRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const shouldStickToBottomRef = useRef(true);
  const restoreScrollAfterPrependRef = useRef(null);
  const previousVisibleRef = useRef(isVisible);

  useEffect(() => {
    const cachedThread = readCachedThread(conversationKey);
    const cachedConversation =
      cachedThread?.conversation || readCachedConversation(conversationKey);
    setConversation(cachedConversation || null);
    setMessages(filterRealConversationMessages(cachedThread?.messages || []));
    setOrderContext(cachedThread?.orderContext || null);
    setHasMore(Boolean(cachedThread?.hasMore));
    setError(null);
    setSendError(null);
    shouldStickToBottomRef.current = true;
  }, [conversationKey]);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const loadThread = useCallback(async () => {
    if (!conversationKey || authStatus !== "authenticated") return;
    const requestId = ++requestIdRef.current;
    inflightRef.current?.abort?.();
    const hasCachedData = Boolean(conversation || messages.length);
    setLoading(!hasCachedData);
    setError(null);
    const safeRequest = createFetchSafe(
      async ({ signal }) => {
        const thread = await fetchCustomerConversationThread({
          conversationId: conversationKey,
          signal,
        });
        return {
          convo: thread.conversation,
          nextMessages: thread.messages,
          nextOrderContext: thread.orderContext,
          hasMore: thread.hasMore,
        };
      },
      { label: "customer-conversation-thread" }
    );
    inflightRef.current = safeRequest;
    try {
      const result = await memoizeRequest(
        `customer-conversation:${conversationKey}`,
        safeRequest.run
      );
      if (!result || result.aborted) return;
      if (requestId !== requestIdRef.current) return;
      if (!result.ok) throw result.error;
      const nextConversation = result.result?.convo ?? conversation ?? null;
      const nextOrderContext = result.result?.nextOrderContext ?? null;
      const nextMessages = result.result?.nextMessages ?? [];
      setConversation(nextConversation);
      setOrderContext(nextOrderContext);
      shouldStickToBottomRef.current = !messages.length;
      setMessages(nextMessages);
      setHasMore(Boolean(result.result?.hasMore));
      writeCachedThread(conversationKey, {
        conversation: nextConversation,
        orderContext: nextOrderContext,
        messages: nextMessages,
        hasMore: Boolean(result.result?.hasMore),
      });
    } catch (err) {
      console.error("Failed to load conversation", err);
      if (requestId === requestIdRef.current) {
        if (conversation || messages.length) {
          setError(null);
        } else {
          setError("We couldn’t load this conversation. Try again soon.");
        }
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [authStatus, conversation, conversationKey, messages.length]);

  useEffect(() => {
    return () => {
      inflightRef.current?.abort?.();
    };
  }, []);

  const reloadMessages = useCallback(async () => {
    if (!conversationKey || authStatus !== "authenticated") return;
    try {
      const page = await fetchCustomerMessagePage({
        conversationId: conversationKey,
      });
      shouldStickToBottomRef.current = isNearBottomRef.current;
      setMessages(page.messages);
      setHasMore(page.hasMore);
      writeCachedThread(conversationKey, {
        conversation,
        orderContext,
        messages: page.messages,
        hasMore: page.hasMore,
      });
    } catch (err) {
      console.error("Failed to reload messages", err);
    }
  }, [authStatus, conversation, conversationKey, orderContext]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const handleVisibility = () => setIsVisible(!document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    if (!hydrated || loadingUser || !conversationKey) return;
    if (authStatus !== "authenticated") return;
    loadThread();
  }, [authStatus, hydrated, loadingUser, conversationKey, loadThread]);

  useEffect(() => {
    const wasVisible = previousVisibleRef.current;
    previousVisibleRef.current = isVisible;
    if (wasVisible || !isVisible) return;
    if (!hydrated || !conversationKey || !conversation) return;
    if (authStatus !== "authenticated") return;
    void reloadMessages();
  }, [
    authStatus,
    conversation,
    conversationKey,
    hydrated,
    isVisible,
    reloadMessages,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!conversationKey) return;
    window.sessionStorage.setItem("yb-last-opened-conversation", conversationKey);
  }, [conversationKey]);

  const notifyUnreadRefresh = useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent(UNREAD_REFRESH_EVENT, {
        detail: { role: "customer", conversationId: conversationKey },
      })
    );
  }, [conversationKey]);

  useEffect(() => {
    if (!hydrated || !userId || !conversationKey) return;
    if (authStatus !== "authenticated") return;
    const client = getSupabaseBrowserClient();
    markConversationRead({ supabase: client, conversationId: conversationKey })
      .then(() => {
        notifyUnreadRefresh();
      })
      .catch((err) => {
        console.warn("Failed to mark conversation read", err);
      });
  }, [authStatus, hydrated, userId, conversationKey, notifyUnreadRefresh]);

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
  }, [messages.length, loadingMore]);

  const buildThreadChannel = useCallback(
    (activeClient) =>
      activeClient
        .channel(`messages-${conversationKey}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationKey}`,
          },
          (payload) => {
            const next = payload.new;
            if (!next?.id) return;
            if (isSystemOrderMessage(next)) {
              void loadThread();
              return;
            }
            if (!isRealConversationMessage(next)) return;
            shouldStickToBottomRef.current = isNearBottomRef.current;
            setMessages((prev) => {
              const nextMessages = appendMessageDedup(prev, next);
              writeCachedThread(conversationKey, {
                conversation,
                orderContext,
                messages: nextMessages,
                hasMore,
              });
              return nextMessages;
            });
            if (next.recipient_id === userId) {
              markConversationRead({
                supabase: activeClient,
                conversationId: conversationKey,
              })
                .then(() => {
                  notifyUnreadRefresh();
                })
                .catch(() => {});
            }
          }
        ),
    [
      conversation,
      conversationKey,
      hasMore,
      loadThread,
      notifyUnreadRefresh,
      orderContext,
      userId,
    ]
  );

  useRealtimeChannel({
    supabase,
    enabled: hydrated && authStatus === "authenticated" && Boolean(conversationKey),
    buildChannel: buildThreadChannel,
    diagLabel: "customer-thread",
  });

  const loadOlder = useCallback(async () => {
    if (!conversationKey || loadingMore || !hasMore) return;
    if (authStatus !== "authenticated") return;
    const oldestMessage = messages[0];
    const oldest = oldestMessage?.created_at;
    if (!oldest) return;

    const requestId = ++loadOlderRequestIdRef.current;
    if (scrollRef.current) {
      restoreScrollAfterPrependRef.current = {
        scrollHeight: scrollRef.current.scrollHeight,
        scrollTop: scrollRef.current.scrollTop,
      };
    }
    setLoadingMore(true);
    try {
      const page = await fetchCustomerMessagePage({
        conversationId: conversationKey,
        before: oldest,
        beforeId: oldestMessage?.id || null,
      });
      if (requestId !== loadOlderRequestIdRef.current) return;
      const older = page.messages;
      if (older.length === 0) {
        setHasMore(false);
      } else {
        shouldStickToBottomRef.current = false;
        setMessages((prev) => {
          const nextMessages = prependMessagesDedup(prev, older);
          writeCachedThread(conversationKey, {
            conversation,
            orderContext,
            messages: nextMessages,
            hasMore: page.hasMore,
          });
          return nextMessages;
        });
        setHasMore(page.hasMore);
      }
    } catch (err) {
      restoreScrollAfterPrependRef.current = null;
      console.error("Failed to load older messages", err);
    } finally {
      setLoadingMore(false);
    }
  }, [
    authStatus,
    conversation,
    conversationKey,
    hasMore,
    loadingMore,
    messages,
    orderContext,
  ]);

  const handleSend = useCallback(
    async (body) => {
      if (!conversation) {
        setSendError("Conversation unavailable.");
        return;
      }
      setSendError(null);
      try {
        const sent = await sendCustomerConversationReply({
          conversation,
          body,
        });
        if (sent?.id && isRealConversationMessage(sent)) {
          shouldStickToBottomRef.current = true;
          setMessages((prev) => {
            const nextMessages = appendMessageDedup(prev, sent);
            writeCachedThread(conversationKey, {
              conversation,
              orderContext,
              messages: nextMessages,
              hasMore,
            });
            return nextMessages;
          });
        }
      } catch (err) {
        console.error("Message send failed", err);
        setSendError(err?.message || "Message failed to send.");
      }
    },
    [conversation, conversationKey, hasMore, orderContext]
  );

  const otherProfile = useMemo(() => {
    if (!conversation) return null;
    return conversation.customer_id === userId
      ? conversation.business
      : conversation.customer;
  }, [conversation, userId]);

  const headerName = otherProfile ? getDisplayName(otherProfile) : "Business";
  const businessProfileHref =
    otherProfile && (otherProfile.public_id || otherProfile.id)
      ? getBusinessPublicUrl(otherProfile)
      : "";

  return (
    <section
      className="relative w-full overflow-hidden bg-[#f6f7fb] text-slate-950"
      style={{
        boxSizing: "border-box",
        height:
          "calc(100dvh - var(--customer-nav-offset, var(--yb-nav-content-offset, 80px)))",
      }}
    >
      <div className="box-border flex h-full min-h-0 w-full px-2 pb-2 sm:px-5 sm:pb-4 md:px-8 md:pb-5 lg:px-12">
        <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-[22px] border border-slate-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.045)] sm:rounded-[28px]">
          <div className="shrink-0 border-b border-slate-100 bg-white px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="space-y-2">
              <Link
                href="/customer/messages"
                className="inline-flex items-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 transition hover:text-slate-700"
              >
                Back to inbox
              </Link>
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Conversation
                </p>
                {businessProfileHref ? (
                  <Link
                    href={businessProfileHref}
                    aria-label={`View ${headerName} profile`}
                    className="group inline-flex min-w-0 items-center gap-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[rgba(var(--brand-rgb),0.35)] focus:ring-offset-2"
                  >
                    <BusinessAvatar
                      profile={otherProfile}
                      name={headerName}
                      alt={headerName}
                      className="h-10 w-10 rounded-2xl border border-slate-100 object-cover transition group-hover:brightness-95 sm:h-11 sm:w-11"
                    />
                    <h1 className="truncate text-base font-semibold text-slate-950 group-hover:underline">
                      {headerName}
                    </h1>
                  </Link>
                ) : (
                  <div className="flex min-w-0 items-center gap-3">
                    <BusinessAvatar
                      profile={otherProfile}
                      name={headerName}
                      alt={headerName}
                      className="h-10 w-10 rounded-2xl border border-slate-100 object-cover sm:h-11 sm:w-11"
                    />
                    <h1 className="truncate text-base font-semibold text-slate-950">
                      {headerName}
                    </h1>
                  </div>
                )}
              </div>
            </div>
          </div>

          {error ? (
            <div className="mx-4 mt-3 shrink-0 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="min-h-0 flex-1 bg-slate-50/45 p-4 text-sm text-slate-500">
              Loading messages...
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col bg-white">
              {orderContext ? (
                <OrderContextCard order={orderContext} />
              ) : null}
              <div
                className={`${orderContext ? "pt-2" : ""} min-h-0 flex-1 overflow-y-auto bg-slate-50/45 px-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 sm:px-4 sm:pb-6 sm:pt-4`}
                ref={scrollRef}
                onScroll={handleThreadScroll}
              >
                {hasMore ? (
                  <div className="mb-4 flex justify-center">
                    <button
                      type="button"
                      onClick={loadOlder}
                      disabled={loadingMore}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-500 shadow-sm transition hover:border-violet-100 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-60"
                    >
                      {loadingMore ? "Loading..." : "Load earlier messages"}
                    </button>
                  </div>
                ) : null}
                <MessageThread
                  messages={messages}
                  currentUserId={userId}
                  variant="light"
                />
              </div>
            </div>
          )}

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
  const href = order?.viewHref || "/account/orders";

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
