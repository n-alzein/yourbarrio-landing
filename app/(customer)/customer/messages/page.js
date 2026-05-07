"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { retry } from "@/lib/retry";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import { createFetchSafe } from "@/lib/fetchSafe";
import { memoizeRequest } from "@/lib/requestMemo";
import {
  filterRealConversationMessages,
  getDisplayName,
  getUnreadCount,
  isRealConversationMessage,
  isSystemOrderMessage,
  markConversationRead,
} from "@/lib/messages";
import { getOrderStatusLabel } from "@/lib/orders";
import { getBusinessPublicUrl } from "@/lib/ids/publicRefs";
import CustomerAccountShell from "@/components/customer/CustomerAccountShell";
import InboxList from "@/components/messages/InboxList";
import BusinessAvatar from "@/components/messages/BusinessAvatar";
import MessageComposer from "@/components/messages/MessageComposer";
import MessageThread from "@/components/messages/MessageThread";
import { useRealtimeChannel } from "@/lib/realtime/useRealtimeChannel";
import {
  appendMessageDedup,
  isNearScrollBottom,
  prependMessagesDedup,
  scrollToBottom,
} from "@/components/messages/realtimeThreadState";
import {
  CUSTOMER_THREAD_PAGE_SIZE,
  fetchCustomerMessagePage,
  fetchCustomerConversationThread,
  sendCustomerConversationReply,
} from "@/components/messages/customerConversationThread";
import { getConversationPreview } from "@/components/messages/inboxPresentation";

const customerConversationsCache = new Map();
const customerThreadCache = new Map();
const CUSTOMER_THREAD_PREFETCH_LIMIT = 3;
const THREAD_STATUSES = {
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  REFRESHING: "refreshing",
  EMPTY: "empty",
  ERROR: "error",
};

function getMessageSortTime(message) {
  const time = new Date(message?.created_at || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function mergeChronologicalMessages(existing = [], incoming = []) {
  const byId = new Map();
  filterRealConversationMessages([...existing, ...incoming]).forEach((message) => {
    if (message?.id) byId.set(message.id, message);
  });
  return Array.from(byId.values()).sort((left, right) => {
    const timeDiff = getMessageSortTime(left) - getMessageSortTime(right);
    if (timeDiff !== 0) return timeDiff;
    return String(left?.id || "").localeCompare(String(right?.id || ""));
  });
}

function getCachedCustomerThread(conversationId) {
  if (!conversationId) return null;
  return customerThreadCache.get(conversationId) || null;
}

function createThreadState(conversationId, patch = {}) {
  const messages = mergeChronologicalMessages([], patch.messages || []);
  const hasFetched = Boolean(
    patch.lastFetchedAt || patch.loadedPageCount || patch.status === THREAD_STATUSES.EMPTY
  );
  const status =
    patch.status ||
    (messages.length
      ? THREAD_STATUSES.READY
      : hasFetched
        ? THREAD_STATUSES.EMPTY
        : THREAD_STATUSES.IDLE);
  const oldest = messages[0] || null;
  return {
    conversationId,
    status,
    conversation: patch.conversation || null,
    orderContext: patch.orderContext || null,
    messages,
    hasOlderMessages: Boolean(
      patch.hasOlderMessages ?? patch.hasMore ?? false
    ),
    oldestCursor: oldest
      ? { createdAt: oldest.created_at || null, id: oldest.id || null }
      : null,
    error: patch.error || null,
    syncError: patch.syncError || null,
    lastFetchedAt: patch.lastFetchedAt || 0,
    loadedPageCount: patch.loadedPageCount || 0,
    requestId: patch.requestId || 0,
    loadingOlder: Boolean(patch.loadingOlder),
  };
}

function setCachedCustomerThread(conversationId, patch) {
  if (!conversationId) return null;
  const existing =
    customerThreadCache.get(conversationId) || createThreadState(conversationId);
  const mergedMessages =
    patch.messages === undefined
      ? existing.messages
      : mergeChronologicalMessages([], patch.messages);
  const next = createThreadState(conversationId, {
    ...existing,
    ...patch,
    messages: mergedMessages,
    hasOlderMessages:
      patch.hasOlderMessages ?? patch.hasMore ?? existing.hasOlderMessages,
    loadedPageCount: patch.loadedPageCount ?? existing.loadedPageCount,
    lastFetchedAt: patch.lastFetchedAt ?? existing.lastFetchedAt,
    requestId: patch.requestId ?? existing.requestId,
  });
  customerThreadCache.set(conversationId, next);
  return next;
}

function getThreadStateForConversation(conversationId, selectedSummary = null) {
  const cached = getCachedCustomerThread(conversationId);
  if (cached) {
    return selectedSummary && !cached.conversation
      ? setCachedCustomerThread(conversationId, { conversation: selectedSummary })
      : cached;
  }
  return createThreadState(conversationId, {
    conversation: selectedSummary || null,
  });
}

function hydrateCustomerThreadCache(thread) {
  if (!thread?.conversationId) return null;
  const previous = getCachedCustomerThread(thread.conversationId);
  const incomingMessages = Array.isArray(thread.messages)
    ? thread.messages
    : [];
  const messages = previous?.messages?.length
    ? mergeChronologicalMessages(previous.messages, incomingMessages)
    : incomingMessages;
  return setCachedCustomerThread(thread.conversationId, {
    conversation: thread.conversation ?? previous?.conversation ?? null,
    orderContext: thread.orderContext ?? previous?.orderContext ?? null,
    messages,
    hasOlderMessages: Boolean(thread.hasMore || previous?.hasOlderMessages),
    loadedPageCount: Math.max(
      previous?.loadedPageCount || 0,
      thread.error ? 0 : 1
    ),
    status: thread.error
      ? THREAD_STATUSES.ERROR
      : messages.length
        ? THREAD_STATUSES.READY
        : THREAD_STATUSES.EMPTY,
    error: thread.error || null,
    syncError: null,
    lastFetchedAt: thread.error ? previous?.lastFetchedAt || 0 : Date.now(),
  });
}

function shouldSkipThreadPrefetch() {
  if (typeof navigator === "undefined") return false;
  const connection =
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection;
  if (!connection) return false;
  if (connection.saveData) return true;
  return ["slow-2g", "2g"].includes(connection.effectiveType);
}

export default function CustomerMessagesPage() {
  const router = useRouter();
  const { user, supabase, loadingUser, authStatus } = useAuth();
  const userId = user?.id || null;
  const cachedConversations = userId
    ? customerConversationsCache.get(userId)
    : undefined;
  const hasCachedConversations = Array.isArray(cachedConversations);

  const [hydrated, setHydrated] = useState(false);
  const [conversations, setConversations] = useState(() =>
    hasCachedConversations ? cachedConversations : []
  );
  const [hasLoaded, setHasLoaded] = useState(hasCachedConversations);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [threadParam, setThreadParam] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("thread") || "";
  });
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const requestIdRef = useRef(0);
  const hasLoadedRef = useRef(hasCachedConversations);
  const inflightRef = useRef(null);
  const [isVisible, setIsVisible] = useState(
    typeof document === "undefined" ? true : !document.hidden
  );
  const applyLocalRead = useCallback((rows = []) => {
    if (typeof window === "undefined") return rows;
    const lastOpenedId = window.sessionStorage.getItem(
      "yb-last-opened-conversation"
    );
    if (!lastOpenedId) return rows;
    const nextRows = rows.map((row) =>
      row?.id === lastOpenedId
        ? { ...row, customer_unread_count: 0 }
        : row
    );
    window.sessionStorage.removeItem("yb-last-opened-conversation");
    return nextRows;
  }, []);

  useEffect(() => {
    if (threadParam) {
      setSelectedConversationId(threadParam);
    }
  }, [threadParam]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const syncThreadParam = () => {
      setThreadParam(
        new URLSearchParams(window.location.search).get("thread") || ""
      );
    };
    syncThreadParam();
    window.addEventListener("popstate", syncThreadParam);
    return () => window.removeEventListener("popstate", syncThreadParam);
  }, []);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!userId) {
      hasLoadedRef.current = false;
      setHasLoaded(false);
      setConversations([]);
      return;
    }

    const cachedRows = customerConversationsCache.get(userId);
    if (Array.isArray(cachedRows)) {
      const nextRows = applyLocalRead(cachedRows);
      customerConversationsCache.set(userId, nextRows);
      hasLoadedRef.current = true;
      setHasLoaded(true);
      setConversations(nextRows);
      return;
    }

    hasLoadedRef.current = false;
    setHasLoaded(false);
    setConversations([]);
  }, [applyLocalRead, userId]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleVisibility = () => setIsVisible(!document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const loadConversations = useCallback(async () => {
    if (!userId || authStatus !== "authenticated") return;
    const requestId = ++requestIdRef.current;
    inflightRef.current?.abort?.();
    const hasUsableData = hasLoadedRef.current;
    setLoading(!hasUsableData);
    setRefreshing(hasUsableData);
    setError(null);
    const safeRequest = createFetchSafe(
      async ({ signal }) => {
        const params = new URLSearchParams({
          includeInitialThread: "1",
          initialThreadLimit: String(CUSTOMER_THREAD_PAGE_SIZE),
        });
        if (threadParam) params.set("selectedConversationId", threadParam);
        const response = await retry(
          () =>
            fetchWithTimeout(
              `/api/customer/conversations?${params.toString()}`,
              {
                method: "GET",
                credentials: "include",
                timeoutMs: 12000,
                signal,
              }
            ),
          { retries: 1, delayMs: 600 }
        );
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "Failed to load conversations");
        }
        const payload = await response.json();
        return {
          conversations: Array.isArray(payload?.conversations)
            ? payload.conversations
            : [],
          initialThread: payload?.initialThread || null,
        };
      },
      { label: "customer-conversations" }
    );
    inflightRef.current = safeRequest;
    try {
      const result = await memoizeRequest(
        `customer-conversations:${userId}:${threadParam || "latest"}`,
        safeRequest.run
      );
      if (!result || result.aborted) return;
      if (requestId !== requestIdRef.current) return;
      if (!result.ok) {
        throw result.error || new Error("Failed to load conversations");
      }
      if (result.result?.initialThread) {
        hydrateCustomerThreadCache(result.result.initialThread);
        if (result.result.initialThread.conversationId) {
          setSelectedConversationId(result.result.initialThread.conversationId);
        }
      }
      const nextRows = applyLocalRead(result.result?.conversations || []);
      customerConversationsCache.set(userId, nextRows);
      setConversations(nextRows);
      hasLoadedRef.current = true;
      setHasLoaded(true);
    } catch (err) {
      console.error("Failed to load conversations", err);
      if (requestId === requestIdRef.current) {
        setError("We couldn’t load your messages. Please try again.");
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [applyLocalRead, authStatus, threadParam, userId]);

  useEffect(() => {
    return () => {
      inflightRef.current?.abort?.();
    };
  }, []);

  useEffect(() => {
    if (!hydrated || loadingUser || !userId) return;
    if (authStatus !== "authenticated") return;
    if (!isVisible && hasLoadedRef.current) return;
    loadConversations();
  }, [authStatus, hydrated, loadingUser, userId, loadConversations, isVisible]);

  const buildConversationsChannel = useCallback(
    (activeClient) =>
      activeClient
        .channel(`conversations-customer-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "conversations",
            filter: `customer_id=eq.${userId}`,
          },
          () => {
            loadConversations();
          }
        ),
    [userId, loadConversations]
  );

  useRealtimeChannel({
    supabase,
    enabled:
      hydrated && !loadingUser && authStatus === "authenticated" && Boolean(userId),
    buildChannel: buildConversationsChannel,
    diagLabel: "customer-conversations",
  });

  useEffect(() => {
    if (!conversations.length) {
      setSelectedConversationId("");
      return;
    }
    if (
      selectedConversationId &&
      conversations.some((conversation) => conversation.id === selectedConversationId)
    ) {
      return;
    }
    const queryConversationExists =
      threadParam &&
      conversations.some((conversation) => conversation.id === threadParam);
    const nextId = queryConversationExists ? threadParam : conversations[0]?.id || "";
    if (nextId) setSelectedConversationId(nextId);
  }, [conversations, selectedConversationId, threadParam]);

  const handleDesktopSelect = useCallback(
    (conversationId) => {
      if (!conversationId) return;
      setSelectedConversationId(conversationId);
      const params = new URLSearchParams(
        typeof window === "undefined" ? "" : window.location.search
      );
      params.set("thread", conversationId);
      setThreadParam(conversationId);
      router.replace(`/customer/messages?${params.toString()}`, {
        scroll: false,
      });
    },
    [router]
  );

  useEffect(() => {
    if (authStatus !== "authenticated") return undefined;
    if (!conversations.length || shouldSkipThreadPrefetch()) return undefined;
    const prefetchIds = conversations
      .filter((conversation) => conversation.id !== selectedConversationId)
      .map((conversation) => conversation.id)
      .filter((conversationId) => {
        const cached = getCachedCustomerThread(conversationId);
        return (
          !cached?.messages?.length &&
          cached?.status !== THREAD_STATUSES.LOADING &&
          cached?.status !== THREAD_STATUSES.REFRESHING
        );
      })
      .slice(0, CUSTOMER_THREAD_PREFETCH_LIMIT);

    if (!prefetchIds.length) return undefined;

    let cancelled = false;
    const prefetch = async () => {
      for (const conversationId of prefetchIds) {
        if (cancelled) return;
        setCachedCustomerThread(conversationId, {
          status: THREAD_STATUSES.LOADING,
          error: null,
          syncError: null,
        });
        try {
          const thread = await fetchCustomerConversationThread({ conversationId });
          if (cancelled) return;
          hydrateCustomerThreadCache({
            conversationId,
            ...thread,
          });
        } catch {
          if (!cancelled) {
            setCachedCustomerThread(conversationId, {
              status: THREAD_STATUSES.IDLE,
              error: null,
              syncError: null,
            });
          }
        }
      }
    };

    const schedule =
      typeof window !== "undefined" && "requestIdleCallback" in window
        ? window.requestIdleCallback(() => {
            void prefetch();
          })
        : window.setTimeout(() => {
            void prefetch();
          }, 400);

    return () => {
      cancelled = true;
      if (typeof window !== "undefined" && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(schedule);
      } else {
        window.clearTimeout(schedule);
      }
    };
  }, [authStatus, conversations, selectedConversationId]);

  const intro = useMemo(
    () =>
      "Message local businesses, confirm details, and keep everything organized in one inbox.",
    []
  );

  const conversationCount = conversations.length;
  const isInitialLoading = loading && !hasLoaded && conversations.length === 0;
  const isRefreshing = refreshing && hasLoaded;
  const countLabel = `${conversationCount} chat${conversationCount === 1 ? "" : "s"}`;

  return (
    <section className="w-full min-h-screen bg-[#f6f7fb] pb-10 text-slate-950 md:pb-14">
      <CustomerAccountShell className="!bg-transparent">
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200/80 pb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Inbox
              </p>
              <div className="mt-1.5">
                <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
                  Messages
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">{intro}</p>
              </div>
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm">
              {countLabel}
              {isRefreshing ? (
                <span className="ml-2 text-slate-400">Updating...</span>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <span>{error}</span>
              <button
                type="button"
                onClick={loadConversations}
                className="rounded-full border border-rose-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700 hover:text-rose-900"
              >
                Try again
              </button>
            </div>
          ) : null}

          <div className="mt-2">
            <div className="lg:hidden">
              <InboxList
                conversations={conversations}
                role="customer"
                basePath="/customer/messages"
                loading={isInitialLoading}
                variant="customer-flat"
              />
            </div>
            <DesktopMessagesShell
              conversations={conversations}
              selectedConversationId={selectedConversationId}
              onSelectConversation={handleDesktopSelect}
              loading={isInitialLoading}
              userId={userId}
              supabase={supabase}
              authStatus={authStatus}
            />
          </div>
        </div>
      </CustomerAccountShell>
    </section>
  );
}

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

function DesktopMessagesShell({
  conversations,
  selectedConversationId,
  onSelectConversation,
  loading,
  userId,
  supabase,
  authStatus,
}) {
  return (
    <div className="hidden overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.045)] lg:grid lg:h-[clamp(400px,calc(100dvh-var(--yb-nav-content-offset,80px)-10.5rem),600px)] lg:grid-cols-[350px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-r border-slate-100">
        <div className="shrink-0 border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-950">Conversations</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {conversations.length
              ? `${conversations.length} active chat${conversations.length === 1 ? "" : "s"}`
              : "No active chats"}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {loading ? (
            <DesktopConversationSkeleton />
          ) : conversations.length ? (
            conversations.map((conversation) => (
              <DesktopConversationRow
                key={conversation.id}
                conversation={conversation}
                selected={conversation.id === selectedConversationId}
                onSelect={() => onSelectConversation(conversation.id)}
              />
            ))
          ) : (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-semibold text-slate-950">
                No messages yet
              </p>
              <p className="mx-auto mt-1 max-w-[240px] text-sm text-slate-500">
                Browse listings or visit a business profile to start a conversation.
              </p>
              <Link
                href="/listings"
                className="yb-primary-button mt-4 inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium !text-white"
              >
                Browse listings
              </Link>
            </div>
          )}
        </div>
      </aside>

      <CustomerDesktopThreadPane
        key={selectedConversationId || "empty-thread"}
        conversationId={selectedConversationId}
        conversations={conversations}
        userId={userId}
        supabase={supabase}
        authStatus={authStatus}
      />
    </div>
  );
}

function DesktopConversationSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex gap-3 rounded-2xl px-3 py-3">
          <div className="h-11 w-11 rounded-2xl bg-slate-100" />
          <div className="min-w-0 flex-1 pt-1">
            <div className="h-3.5 w-32 rounded-full bg-slate-100" />
            <div className="mt-3 h-3 w-44 rounded-full bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DesktopConversationRow({ conversation, selected, onSelect }) {
  const profile = conversation.business;
  const displayName = getDisplayName(profile);
  const unreadCount = getUnreadCount(conversation, "customer");
  const preview = getConversationPreview(conversation);
  const previewTime = formatPreviewTime(conversation.last_message_at);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
        selected
          ? "bg-[rgba(var(--brand-rgb),0.08)]"
          : "hover:bg-slate-50"
      }`}
    >
      <BusinessAvatar
        profile={profile}
        name={displayName}
        alt={displayName}
        className="h-11 w-11 shrink-0 rounded-2xl border border-slate-100 object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="truncate text-sm font-semibold text-slate-950">
            {displayName}
          </p>
          <span className="shrink-0 pt-0.5 text-[11px] text-slate-400">
            {previewTime}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm text-slate-500">
            {preview}
          </p>
          {unreadCount > 0 ? (
            <span className="min-w-[22px] rounded-full bg-rose-500 px-1.5 py-0.5 text-center text-[10px] font-semibold text-white">
              {unreadCount}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function CustomerDesktopThreadPane({
  conversationId,
  conversations,
  userId,
  supabase,
  authStatus,
}) {
  const selectedSummary = conversations.find(
    (conversation) => conversation.id === conversationId
  );
  const [threadState, setThreadState] = useState(() =>
    getThreadStateForConversation(conversationId, selectedSummary)
  );
  const [sendError, setSendError] = useState(null);
  const scrollRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const shouldStickToBottomRef = useRef(true);
  const requestIdRef = useRef(0);
  const loadOlderRequestIdRef = useRef(0);
  const restoreScrollAfterPrependRef = useRef(null);
  const selectedThreadRef = useRef(conversationId);

  const commitThreadState = useCallback((targetConversationId, patch) => {
    const nextState = setCachedCustomerThread(targetConversationId, patch);
    if (selectedThreadRef.current === targetConversationId && nextState) {
      setThreadState(nextState);
    }
    return nextState;
  }, []);

  useEffect(() => {
    selectedThreadRef.current = conversationId;
    shouldStickToBottomRef.current = true;
  }, [conversationId]);

  const loadThread = useCallback(async () => {
    if (!conversationId || authStatus !== "authenticated") return;
    const requestId = ++requestIdRef.current;
    const targetConversationId = conversationId;
    const cached = getThreadStateForConversation(
      targetConversationId,
      selectedSummary
    );
    const hasRenderableData =
      cached.messages.length > 0 || cached.loadedPageCount > 0;
    commitThreadState(targetConversationId, {
      status: hasRenderableData
        ? THREAD_STATUSES.REFRESHING
        : THREAD_STATUSES.LOADING,
      requestId,
      error: null,
      syncError: null,
    });
    try {
      const thread = await fetchCustomerConversationThread({
        conversationId: targetConversationId,
      });
      if (
        requestId !== requestIdRef.current ||
        selectedThreadRef.current !== targetConversationId
      ) {
        return;
      }
      const previous = getCachedCustomerThread(targetConversationId);
      const mergedMessages = previous?.messages?.length
        ? mergeChronologicalMessages(previous.messages, thread.messages)
        : thread.messages;
      commitThreadState(targetConversationId, {
        conversation: thread.conversation ?? selectedSummary ?? null,
        orderContext: thread.orderContext ?? null,
        messages: mergedMessages,
        hasOlderMessages: Boolean(thread.hasMore || previous?.hasOlderMessages),
        loadedPageCount: Math.max(
          previous?.loadedPageCount || 0,
          1
        ),
        status: mergedMessages.length
          ? THREAD_STATUSES.READY
          : THREAD_STATUSES.EMPTY,
        error: null,
        syncError: null,
        requestId,
        lastFetchedAt: Date.now(),
      });
      shouldStickToBottomRef.current = hasRenderableData
        ? isNearBottomRef.current
        : true;
    } catch (err) {
      console.error("Failed to load selected conversation", err);
      const message = "We couldn't load messages yet. Try again.";
      const previous = getThreadStateForConversation(
        targetConversationId,
        selectedSummary
      );
      commitThreadState(targetConversationId, {
        status:
          previous.messages.length
            ? THREAD_STATUSES.READY
            : previous.loadedPageCount
              ? THREAD_STATUSES.EMPTY
              : THREAD_STATUSES.ERROR,
        error:
          previous.messages.length || previous.loadedPageCount ? null : message,
        syncError:
          previous.messages.length || previous.loadedPageCount ? message : null,
        requestId,
      });
    }
  }, [authStatus, commitThreadState, conversationId, selectedSummary]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadThread();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [loadThread]);

  useEffect(() => {
    if (!conversationId || authStatus !== "authenticated") return;
    markConversationRead({ supabase, conversationId }).catch(() => {});
  }, [authStatus, conversationId, supabase]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const restore = restoreScrollAfterPrependRef.current;
    if (restore) {
      scrollRef.current.scrollTop =
        scrollRef.current.scrollHeight - restore.scrollHeight + restore.scrollTop;
      restoreScrollAfterPrependRef.current = null;
      return;
    }
    if (!shouldStickToBottomRef.current && !isNearBottomRef.current) return;
    const handle = requestAnimationFrame(() => {
      scrollToBottom(scrollRef.current);
      shouldStickToBottomRef.current = false;
      isNearBottomRef.current = true;
    });
    return () => cancelAnimationFrame(handle);
  }, [threadState.messages.length, conversationId]);

  const buildThreadChannel = useCallback(
    (activeClient) =>
      activeClient
        .channel(`customer-desktop-messages-${conversationId}`)
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
            if (isSystemOrderMessage(next)) {
              void loadThread();
              return;
            }
            if (!isRealConversationMessage(next)) return;
            shouldStickToBottomRef.current = isNearBottomRef.current;
            const previous = getThreadStateForConversation(conversationId);
            const nextMessages = appendMessageDedup(previous.messages, next);
            commitThreadState(conversationId, {
              messages: nextMessages,
              status: THREAD_STATUSES.READY,
              loadedPageCount: Math.max(previous.loadedPageCount, 1),
              error: null,
              syncError: null,
            });
          }
        ),
    [commitThreadState, conversationId, loadThread]
  );

  useRealtimeChannel({
    supabase,
    enabled: authStatus === "authenticated" && Boolean(conversationId),
    buildChannel: buildThreadChannel,
    diagLabel: "customer-desktop-thread",
  });

  const handleThreadScroll = useCallback(() => {
    isNearBottomRef.current = isNearScrollBottom(scrollRef.current);
  }, []);

  const loadEarlierMessages = useCallback(async () => {
    if (
      !conversationId ||
      threadState.loadingOlder ||
      !threadState.hasOlderMessages
    ) {
      return;
    }
    const oldestMessage = threadState.messages[0];
    if (!oldestMessage?.created_at) return;
    const requestId = ++loadOlderRequestIdRef.current;
    if (scrollRef.current) {
      restoreScrollAfterPrependRef.current = {
        scrollHeight: scrollRef.current.scrollHeight,
        scrollTop: scrollRef.current.scrollTop,
      };
    }
    commitThreadState(conversationId, { loadingOlder: true });
    try {
      const page = await fetchCustomerMessagePage({
        conversationId,
        before: oldestMessage.created_at,
        beforeId: oldestMessage.id || null,
      });
      if (requestId !== loadOlderRequestIdRef.current) {
        commitThreadState(conversationId, { loadingOlder: false });
        return;
      }
      if (page.messages.length === 0) {
        commitThreadState(conversationId, {
          hasOlderMessages: false,
          loadingOlder: false,
        });
        restoreScrollAfterPrependRef.current = null;
        return;
      }
      shouldStickToBottomRef.current = false;
      const previous = getThreadStateForConversation(conversationId);
      const nextMessages = prependMessagesDedup(previous.messages, page.messages);
      commitThreadState(conversationId, {
        messages: nextMessages,
        hasOlderMessages: page.hasMore,
        loadedPageCount: (previous.loadedPageCount || 1) + 1,
        status: nextMessages.length ? THREAD_STATUSES.READY : THREAD_STATUSES.EMPTY,
        loadingOlder: false,
      });
    } catch (err) {
      restoreScrollAfterPrependRef.current = null;
      console.error("Failed to load earlier messages", err);
      commitThreadState(conversationId, {
        loadingOlder: false,
        syncError: "Earlier messages could not be loaded.",
      });
    }
  }, [commitThreadState, conversationId, threadState]);

  const handleSend = useCallback(
    async (body) => {
      if (!threadState.conversation) return;
      setSendError(null);
      try {
        const sent = await sendCustomerConversationReply({
          conversation: threadState.conversation,
          body,
        });
        if (sent?.id && isRealConversationMessage(sent)) {
          shouldStickToBottomRef.current = true;
          const previous = getThreadStateForConversation(threadState.conversation.id);
          const nextMessages = appendMessageDedup(previous.messages, sent);
          commitThreadState(threadState.conversation.id, {
            messages: nextMessages,
            status: THREAD_STATUSES.READY,
            loadedPageCount: Math.max(previous.loadedPageCount, 1),
            error: null,
            syncError: null,
          });
        }
      } catch (err) {
        console.error("Message send failed", err);
        setSendError(err?.message || "Message failed to send.");
      }
    },
    [commitThreadState, threadState.conversation]
  );

  if (!conversationId || !conversations.length) {
    return (
      <section className="flex min-h-0 items-center justify-center bg-slate-50/70 px-8 py-8">
        <div className="max-w-sm text-center">
          <p className="text-lg font-semibold text-slate-950">
            Select a conversation
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Your chats with local businesses will open here on larger screens.
          </p>
        </div>
      </section>
    );
  }

  const profile = threadState.conversation?.business || selectedSummary?.business || null;
  const displayName = getDisplayName(profile);
  const profileHref =
    profile && (profile.public_id || profile.id)
      ? getBusinessPublicUrl(profile)
      : "";
  const showInlineThreadLoading =
    threadState.status === THREAD_STATUSES.LOADING &&
    threadState.messages.length === 0;
  const showBlockingError =
    threadState.status === THREAD_STATUSES.ERROR &&
    threadState.messages.length === 0;

  return (
    <section className="flex min-h-0 flex-col bg-white">
      <div className="shrink-0 border-b border-slate-100 px-5 py-3">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Conversation
          </p>
          {profileHref ? (
            <Link
              href={profileHref}
              aria-label={`View ${displayName} profile`}
              className="group inline-flex min-w-0 items-center gap-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[rgba(var(--brand-rgb),0.35)] focus:ring-offset-2"
            >
              <BusinessAvatar
                profile={profile}
                name={displayName}
                alt={displayName}
                className="h-11 w-11 rounded-2xl border border-slate-100 object-cover transition group-hover:brightness-95"
              />
              <h2 className="truncate text-base font-semibold text-slate-950 group-hover:underline">
                {displayName}
              </h2>
            </Link>
          ) : (
            <div className="flex min-w-0 items-center gap-3">
              <BusinessAvatar
                profile={profile}
                name={displayName}
                alt={displayName}
                className="h-11 w-11 rounded-2xl border border-slate-100 object-cover"
              />
              <h2 className="truncate text-base font-semibold text-slate-950">
                {displayName}
              </h2>
            </div>
          )}
        </div>
        {threadState.orderContext ? (
          <DesktopOrderContextCard order={threadState.orderContext} />
        ) : null}
      </div>

      <div
        ref={scrollRef}
        onScroll={handleThreadScroll}
        className="min-h-0 flex-1 overflow-y-auto bg-slate-50/45 px-5 pb-6 pt-4"
      >
        {threadState.hasOlderMessages ? (
          <div className="mb-4 flex justify-center">
            <button
              type="button"
              onClick={loadEarlierMessages}
              disabled={threadState.loadingOlder}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm transition hover:border-violet-100 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-60"
            >
              {threadState.loadingOlder ? "Loading..." : "Load earlier messages"}
            </button>
          </div>
        ) : null}
        {showBlockingError ? (
          <div className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{threadState.error}</span>
              <button
                type="button"
                onClick={() => {
                  void loadThread();
                }}
                className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-700 transition hover:text-rose-900"
              >
                Retry
              </button>
            </div>
          </div>
        ) : null}
        {showInlineThreadLoading ? (
          <div className="mb-4 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
            Loading messages...
          </div>
        ) : null}
        {!showInlineThreadLoading ? (
          <MessageThread
            messages={threadState.messages}
            currentUserId={userId}
            loading={false}
            variant="light"
          />
        ) : null}
      </div>

      <div className="shrink-0 border-t border-slate-100 bg-white p-3">
        {sendError ? (
          <div className="mb-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            {sendError}
          </div>
        ) : null}
        <MessageComposer
          onSend={handleSend}
          disabled={!threadState.conversation}
          variant="light"
        />
      </div>
    </section>
  );
}

function DesktopOrderContextCard({ order }) {
  const orderNumber = order?.orderNumber || order?.orderId || "";
  const statusLabel = getOrderStatusLabel(order?.status);
  const href = order?.viewHref || "/account/orders";

  return (
    <aside className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2.5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950">
            Order {orderNumber}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {statusLabel}
            {order?.fulfillmentLabel ? ` · ${order.fulfillmentLabel}` : ""}
          </p>
        </div>
        <Link
          href={href}
          className="yb-primary-button inline-flex h-9 shrink-0 items-center rounded-full px-4 text-xs font-semibold !text-white"
        >
          View order
        </Link>
      </div>
    </aside>
  );
}
