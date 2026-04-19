"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import SafeAvatar from "@/components/SafeAvatar";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getAuthedContext } from "@/lib/auth/getAuthedContext";
import { useRealtimeChannel } from "@/lib/realtime/useRealtimeChannel";
import {
  getAvatarUrl,
  getDisplayName,
  getOtherConversationProfile,
  markConversationRead,
  sendMessage,
  MESSAGE_PAGE_SIZE,
} from "@/lib/messages";
import { retry } from "@/lib/retry";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import { memoizeRequest } from "@/lib/requestMemo";
import MessageThread from "@/components/messages/MessageThread";
import MessageComposer from "@/components/messages/MessageComposer";
import {
  appendMessageDedup,
  getTrackedOrderIds,
  isNearScrollBottom,
  patchOrderStatusMessage,
  prependMessagesDedup,
  scrollToBottom,
} from "@/components/messages/realtimeThreadState";

const UNREAD_REFRESH_EVENT = "yb-unread-refresh";

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
  initialError = null,
  initialUserId = null,
}) {
  const { user, loadingUser, supabase, authStatus } = useAuth();
  const userId = user?.id || initialUserId || null;
  const [conversation, setConversation] = useState(initialConversation);
  const [messages, setMessages] = useState(initialMessages);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(
    initialMessages.length === MESSAGE_PAGE_SIZE
  );
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
  const hasThreadRef = useRef(Boolean(initialConversation));
  const showThreadSkeleton = useDelayedFlag(loading && messages.length === 0);
  const trackedOrderIds = useMemo(() => getTrackedOrderIds(messages), [messages]);
  const trackedOrderKey = trackedOrderIds.join(",");

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
          const [convoResponse, messagesResponse] = await Promise.all([
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
            retry(
              () =>
                fetchWithTimeout(
                  `/api/business/messages?conversationId=${encodeURIComponent(
                    conversationId
                  )}`,
                  {
                    method: "GET",
                    credentials: "include",
                    timeoutMs: 12000,
                  }
                ),
              { retries: 1, delayMs: 600 }
            ),
          ]);

          if (!convoResponse.ok) {
            const message = await convoResponse.text();
            throw new Error(message || "Failed to load conversation");
          }
          if (!messagesResponse.ok) {
            const message = await messagesResponse.text();
            throw new Error(message || "Failed to load messages");
          }

          const [convoPayload, messagesPayload] = await Promise.all([
            convoResponse.json(),
            messagesResponse.json(),
          ]);

          return {
            conversation: convoPayload?.conversation ?? null,
            messages: Array.isArray(messagesPayload?.messages)
              ? messagesPayload.messages
              : [],
          };
        }
      );

      if (requestId !== requestIdRef.current) return;

      setConversation(result.conversation);
      shouldStickToBottomRef.current = true;
      setMessages(result.messages);
      setHasMore(result.messages.length === MESSAGE_PAGE_SIZE);
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
      const response = await retry(
        () =>
          fetchWithTimeout(
            `/api/business/messages?conversationId=${encodeURIComponent(
              conversationId
            )}`,
            {
              method: "GET",
              credentials: "include",
              timeoutMs: 12000,
            }
          ),
        { retries: 1, delayMs: 600 }
      );

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to load messages");
      }

      const payload = await response.json();
      const nextMessages = Array.isArray(payload?.messages) ? payload.messages : [];
      shouldStickToBottomRef.current = true;
      setMessages(nextMessages);
      setHasMore(nextMessages.length === MESSAGE_PAGE_SIZE);
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
    if (!scrollRef.current || loadingMore) return;
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
            shouldStickToBottomRef.current =
              next.type === "order_status_update" ? false : isNearBottomRef.current;
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

  const buildOrderChannel = useCallback(
    (activeClient) => {
      let channel = activeClient.channel(`orders-for-thread-${conversationId}`);
      const orderIds = trackedOrderKey ? trackedOrderKey.split(",") : [];
      orderIds.forEach((orderId) => {
        channel = channel.on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "orders",
            filter: `id=eq.${orderId}`,
          },
          (payload) => {
            const nextOrder = payload.new;
            if (!nextOrder?.id) return;
            shouldStickToBottomRef.current = false;
            setMessages((prev) => patchOrderStatusMessage(prev, nextOrder));
          }
        );
      });
      return channel;
    },
    [conversationId, trackedOrderKey]
  );

  useRealtimeChannel({
    supabase,
    enabled:
      !loadingUser &&
      authStatus === "authenticated" &&
      Boolean(conversationId) &&
      Boolean(trackedOrderKey),
    buildChannel: buildOrderChannel,
    diagLabel: `business-thread-orders-${trackedOrderKey}`,
  });

  const loadOlder = useCallback(async () => {
    if (!conversationId || loadingMore || !hasMore) return;
    if (authStatus !== "authenticated") return;
    const oldest = messages[0]?.created_at;
    if (!oldest) return;

    setLoadingMore(true);
    try {
      const response = await fetchWithTimeout(
        `/api/business/messages?conversationId=${encodeURIComponent(
          conversationId
        )}&before=${encodeURIComponent(oldest)}`,
        {
          method: "GET",
          credentials: "include",
          timeoutMs: 12000,
        }
      );

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to load older messages");
      }

      const payload = await response.json();
      const older = Array.isArray(payload?.messages) ? payload.messages : [];
      if (older.length === 0) {
        setHasMore(false);
      } else {
        shouldStickToBottomRef.current = false;
        setMessages((prev) => prependMessagesDedup(prev, older));
        if (older.length < MESSAGE_PAGE_SIZE) setHasMore(false);
      }
    } catch (err) {
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
        if (sent?.id) {
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
    <>
      <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 md:p-6 backdrop-blur">
        <div className="space-y-4">
          <Link
            href="/business/messages"
            className="mb-3 inline-flex items-center text-xs uppercase tracking-[0.28em] text-white/60 hover:text-white"
          >
            Back to inbox
          </Link>
          <div className="flex items-center gap-4">
            {otherProfile || seededHeader ? (
              <SafeAvatar
                src={headerAvatarUrl}
                name={headerName}
                alt={headerName}
                className="h-12 w-12 rounded-2xl object-cover border border-white/10"
                initialsClassName="text-[13px]"
                iconClassName="h-5 w-5"
              />
            ) : (
              <div className="h-12 w-12 rounded-2xl border border-white/10 bg-white/10 animate-pulse" />
            )}
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                Conversation
              </p>
              {otherProfile || seededHeader ? (
                <h1 className="text-2xl font-semibold text-white">{headerName}</h1>
              ) : (
                <div className="mt-2 h-7 w-44 rounded-full bg-white/10 animate-pulse" />
              )}
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-100 flex flex-wrap items-center justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              void loadThread();
            }}
            className="rounded-full border border-rose-200/40 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-rose-100 hover:text-white"
          >
            Try again
          </button>
        </div>
      ) : null}

      <div className="mt-4 rounded-[28px] border border-white/10 bg-white/5 p-5 md:p-6 space-y-4">
        {messagesError ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 flex flex-wrap items-center justify-between gap-3">
            <span>{messagesError}</span>
            <button
              type="button"
              onClick={() => {
                void reloadMessages();
              }}
              className="rounded-full border border-rose-200/40 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-rose-100 hover:text-white"
            >
              Retry
            </button>
          </div>
        ) : null}

        <div className="flex h-[44vh] flex-col">
          {hasMore ? (
            <button
              type="button"
              onClick={() => {
                void loadOlder();
              }}
              disabled={loadingMore}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/70 hover:text-white"
            >
              {loadingMore ? "Loading..." : "Load older messages"}
            </button>
          ) : null}
          <div
            className="mt-4 flex-1 overflow-y-auto pr-2"
            ref={scrollRef}
            onScroll={handleThreadScroll}
          >
            <MessageThread
              messages={messages}
              currentUserId={userId}
              loading={showThreadSkeleton}
            />
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 mt-4 w-full">
        {sendError ? (
          <div className="mb-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-100">
            {sendError}
          </div>
        ) : null}
        <MessageComposer onSend={handleSend} disabled={!conversation} />
      </div>
    </>
  );
}
