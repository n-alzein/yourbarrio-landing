"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient";
import {
  getAvatarUrl,
  getDisplayName,
  markConversationRead,
  sendMessage,
  MESSAGE_PAGE_SIZE,
} from "@/lib/messages";
import { retry } from "@/lib/retry";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import MessageThread from "@/components/messages/MessageThread";
import MessageComposer from "@/components/messages/MessageComposer";

export default function BusinessConversationPage() {
  const params = useParams();
  const conversationId = params?.conversationId;
  const { user, authUser, loadingUser, supabase } = useAuth();
  const userId = user?.id || authUser?.id || null;
  const conversationKey = useMemo(() => {
    if (Array.isArray(conversationId)) return conversationId[0] || "";
    return typeof conversationId === "string" ? conversationId : "";
  }, [conversationId]);

  const [hydrated, setHydrated] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [messagesError, setMessagesError] = useState(null);
  const threadLoadedRef = useRef(false);
  const [isVisible, setIsVisible] = useState(
    typeof document === "undefined" ? true : !document.hidden
  );

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    threadLoadedRef.current = false;
  }, [conversationKey]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleVisibility = () => setIsVisible(!document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const loadThread = useCallback(async () => {
    if (!conversationKey) return;
    setLoading((prev) => (threadLoadedRef.current ? prev : true));
    setError(null);
    setMessagesError(null);
    try {
      const convoResponse = await fetchWithTimeout(
        `/api/business/conversations?conversationId=${encodeURIComponent(
          conversationKey
        )}`,
        {
          method: "GET",
          credentials: "include",
          timeoutMs: 12000,
        }
      );

      if (!convoResponse.ok) {
        const message = await convoResponse.text();
        throw new Error(message || "Failed to load conversation");
      }

      const convoPayload = await convoResponse.json();
      const convo = convoPayload?.conversation ?? null;
      if (process.env.NODE_ENV !== "production") {
        console.log("Loaded conversation for business view", {
          conversationId,
          convo,
        });
      }
      setConversation(convo);
    } catch (err) {
      console.error("Failed to load conversation", err);
      setError("We couldn’t load this conversation. Try again soon.");
      setLoading(false);
      return;
    }

    try {
      const initialMessages = await retry(
        () =>
          fetchWithTimeout(
            `/api/business/messages?conversationId=${encodeURIComponent(
              conversationKey
            )}`,
            {
              method: "GET",
              credentials: "include",
              timeoutMs: 12000,
            }
          ),
        { retries: 1, delayMs: 600 }
      );
      if (!initialMessages.ok) {
        const message = await initialMessages.text();
        throw new Error(message || "Failed to load messages");
      }
      const payload = await initialMessages.json();
      const nextMessages = Array.isArray(payload?.messages) ? payload.messages : [];
      setMessages(nextMessages);
      setHasMore(nextMessages.length === MESSAGE_PAGE_SIZE);
      threadLoadedRef.current = true;
    } catch (err) {
      console.error("Failed to load messages", err);
      setMessages([]);
      setHasMore(false);
      setMessagesError("We couldn’t load messages yet. Try again.");
    } finally {
      setLoading(false);
    }
  }, [conversationKey]);

  const reloadMessages = useCallback(async () => {
    if (!conversationKey) return;
    setMessagesError(null);
    try {
      const refreshed = await retry(
        () =>
          fetchWithTimeout(
            `/api/business/messages?conversationId=${encodeURIComponent(
              conversationKey
            )}`,
            {
              method: "GET",
              credentials: "include",
              timeoutMs: 12000,
            }
          ),
        { retries: 1, delayMs: 600 }
      );

      if (!refreshed.ok) {
        const message = await refreshed.text();
        throw new Error(message || "Failed to load messages");
      }

      const payload = await refreshed.json();
      const nextMessages = Array.isArray(payload?.messages) ? payload.messages : [];
      setMessages(nextMessages);
      setHasMore(nextMessages.length === MESSAGE_PAGE_SIZE);
    } catch (err) {
      console.error("Failed to reload messages", err);
      setMessagesError("We couldn’t load messages yet. Try again.");
    }
  }, [conversationKey]);

  useEffect(() => {
    if (!hydrated || (!conversationKey && loadingUser)) return;
    if (!isVisible && threadLoadedRef.current) return;
    loadThread();
  }, [hydrated, loadingUser, conversationKey, loadThread, isVisible]);

  useEffect(() => {
    if (!hydrated || !userId || !conversationKey) return;
    const client = getBrowserSupabaseClient() ?? supabase;
    markConversationRead({
      supabase: client,
      conversationId: conversationKey,
    }).catch((err) => {
      console.warn("Failed to mark conversation read", err);
    });
  }, [hydrated, userId, conversationKey, supabase]);

  useEffect(() => {
    if (!hydrated || !conversationKey) return undefined;
    const client = getBrowserSupabaseClient() ?? supabase;
    if (!client) return undefined;

    const channel = client
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
          setMessages((prev) => {
            if (prev.some((item) => item.id === next.id)) return prev;
            return [...prev, next];
          });
          if (next.recipient_id === userId) {
            const clientForRead = getBrowserSupabaseClient() ?? supabase;
            markConversationRead({
              supabase: clientForRead,
              conversationId: conversationKey,
            }).catch(() => {});
          }
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [hydrated, conversationKey, supabase, userId]);

  const loadOlder = useCallback(async () => {
    if (!conversationKey || loadingMore || !hasMore) return;
    const oldest = messages[0]?.created_at;
    if (!oldest) return;

    setLoadingMore(true);
    try {
      const response = await fetchWithTimeout(
        `/api/business/messages?conversationId=${encodeURIComponent(
          conversationKey
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
        setMessages((prev) => [...older, ...prev]);
        if (older.length < MESSAGE_PAGE_SIZE) setHasMore(false);
      }
    } catch (err) {
      console.error("Failed to load older messages", err);
    } finally {
      setLoadingMore(false);
    }
  }, [conversationKey, loadingMore, hasMore, messages]);

  const handleSend = useCallback(
    async (body) => {
      if (!conversation || !userId) return;
      const recipientId =
        conversation.customer_id === userId
          ? conversation.business_id
          : conversation.customer_id;
      const client = getBrowserSupabaseClient() ?? supabase;
      const sent = await sendMessage({
        supabase: client,
        conversationId: conversation.id,
        senderId: userId,
        recipientId,
        body,
      });
      if (sent?.id) {
        setMessages((prev) => {
          if (prev.some((item) => item.id === sent.id)) return prev;
          return [...prev, sent];
        });
      }
    },
    [conversation, supabase, userId]
  );

  const otherProfile = useMemo(() => {
    if (!conversation) return null;
    return conversation.customer_id === userId
      ? conversation.business
      : conversation.customer;
  }, [conversation, userId]);

  if (process.env.NODE_ENV !== "production") {
    console.log("Resolved other profile for header", otherProfile);
  }

  const headerName = getDisplayName(otherProfile);

  return (
    <section className="relative w-full min-h-screen pt-6 md:pt-8 text-white overflow-hidden -mt-8 md:-mt-12 pb-20 md:pb-24">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b0720] via-[#0a0816] to-black" />
        <div className="absolute -top-32 -left-20 h-[360px] w-[360px] rounded-full bg-purple-600/20 blur-[120px]" />
        <div className="absolute top-10 right-10 h-[300px] w-[300px] rounded-full bg-pink-500/15 blur-[120px]" />
      </div>

      <div className="w-full px-5 sm:px-6 md:px-8 lg:px-12">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 md:p-6 backdrop-blur">
            <div className="space-y-4">
              <Link
                href="/business/messages"
                className="mb-3 inline-flex items-center text-xs uppercase tracking-[0.28em] text-white/60 hover:text-white"
              >
                Back to inbox
              </Link>
              <div className="flex items-center gap-4">
                <img
                  src={getAvatarUrl(otherProfile)}
                  alt={headerName}
                  className="h-12 w-12 rounded-2xl object-cover border border-white/10"
                />
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                    Conversation
                  </p>
                  <h1 className="text-2xl font-semibold text-white">{headerName}</h1>
                </div>
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
              Loading conversation...
            </div>
          ) : (
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 md:p-6 space-y-4">
              {messagesError ? (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 flex flex-wrap items-center justify-between gap-3">
                  <span>{messagesError}</span>
                  <button
                    type="button"
                    onClick={reloadMessages}
                    className="rounded-full border border-rose-200/40 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-rose-100 hover:text-white"
                  >
                    Retry
                  </button>
                </div>
              ) : null}
              {hasMore ? (
                <button
                  type="button"
                  onClick={loadOlder}
                  disabled={loadingMore}
                  className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/70 hover:text-white"
                >
                  {loadingMore ? "Loading..." : "Load older messages"}
                </button>
              ) : null}
              <MessageThread messages={messages} currentUserId={userId} />
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 mt-8 w-full px-5 sm:px-6 md:px-8 lg:px-12">
        <div className="max-w-5xl mx-auto">
          <MessageComposer onSend={handleSend} disabled={loading || !conversation} />
        </div>
      </div>
    </section>
  );
}
