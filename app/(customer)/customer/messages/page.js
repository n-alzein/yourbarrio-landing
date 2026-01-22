"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { retry } from "@/lib/retry";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import { createFetchSafe } from "@/lib/fetchSafe";
import { memoizeRequest } from "@/lib/requestMemo";
import InboxList from "@/components/messages/InboxList";
import { useRealtimeChannel } from "@/lib/realtime/useRealtimeChannel";

export default function CustomerMessagesPage() {
  const { user, supabase, loadingUser, authStatus } = useAuth();
  const userId = user?.id || null;

  const [hydrated, setHydrated] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);
  const hasLoadedRef = useRef(false);
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
    setHydrated(true);
  }, []);

  useEffect(() => {
    hasLoadedRef.current = false;
  }, [userId]);

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
    setLoading((prev) => (hasLoadedRef.current ? prev : true));
    setError(null);
    const safeRequest = createFetchSafe(
      async ({ signal }) => {
        const response = await retry(
          () =>
            fetchWithTimeout("/api/customer/conversations", {
              method: "GET",
              credentials: "include",
              timeoutMs: 12000,
              signal,
            }),
          { retries: 1, delayMs: 600 }
        );
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "Failed to load conversations");
        }
        const payload = await response.json();
        return Array.isArray(payload?.conversations)
          ? payload.conversations
          : [];
      },
      { label: "customer-conversations" }
    );
    inflightRef.current = safeRequest;
    try {
      const result = await memoizeRequest(
        `customer-conversations:${userId}`,
        safeRequest.run
      );
      if (!result || result.aborted) return;
      if (requestId !== requestIdRef.current) return;
      if (!result.ok) {
        throw result.error || new Error("Failed to load conversations");
      }
      setConversations(applyLocalRead(result.result || []));
      hasLoadedRef.current = true;
    } catch (err) {
      console.error("Failed to load conversations", err);
      if (requestId === requestIdRef.current) {
        setError("We couldn’t load your messages. Please try again.");
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [authStatus, userId]);

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

  const intro = useMemo(
    () =>
      "Message local businesses, confirm details, and keep everything organized in one inbox.",
    []
  );

  const conversationCount = conversations.length;

  return (
    <section className="relative w-full min-h-screen pt-6 md:pt-8 text-white overflow-hidden -mt-8 md:-mt-12 pb-12 md:pb-16">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b0720] via-[#0a0816] to-black" />
        <div className="absolute -top-32 -left-20 h-[360px] w-[360px] rounded-full bg-purple-600/20 blur-[120px]" />
        <div className="absolute top-10 right-10 h-[300px] w-[300px] rounded-full bg-pink-500/15 blur-[120px]" />
      </div>

      <div className="w-full px-5 sm:px-6 md:px-8 lg:px-12">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-8 backdrop-blur">
            <p className="text-[11px] uppercase tracking-[0.32em] text-white/50">
              Inbox
            </p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-semibold text-white">
                  Messages
                </h1>
                <p className="text-sm text-white/60 mt-2 max-w-2xl">{intro}</p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/70">
                {conversationCount} chats
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-100 flex flex-wrap items-center justify-between gap-3">
              <span>{error}</span>
              <button
                type="button"
                onClick={loadConversations}
                className="rounded-full border border-rose-200/40 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-rose-100 hover:text-white"
              >
                Try again
              </button>
            </div>
          ) : null}

          <InboxList
            conversations={conversations}
            role="customer"
            basePath="/customer/messages"
            loading={loading}
          />
        </div>
      </div>
    </section>
  );
}
