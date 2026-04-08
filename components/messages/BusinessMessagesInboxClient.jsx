"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import InboxList from "@/components/messages/InboxList";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import { useRealtimeChannel } from "@/lib/realtime/useRealtimeChannel";
import { retry } from "@/lib/retry";
import { memoizeRequest } from "@/lib/requestMemo";

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

export default function BusinessMessagesInboxClient({
  initialConversations = [],
  initialError = null,
  initialUserId = null,
  intro = "",
}) {
  const { user, supabase, authStatus, loadingUser } = useAuth();
  const userId = user?.id || initialUserId || null;
  const [conversations, setConversations] = useState(initialConversations);
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);
  const hasLoadedRef = useRef(
    initialError == null && Array.isArray(initialConversations)
  );
  const requestIdRef = useRef(0);
  const [isVisible, setIsVisible] = useState(
    typeof document === "undefined" ? true : !document.hidden
  );
  const showLoading = useDelayedFlag(loading && conversations.length === 0);

  const applyLocalRead = useCallback((rows = []) => {
    if (typeof window === "undefined") return rows;
    const lastOpenedId = window.sessionStorage.getItem(
      "yb-last-opened-conversation"
    );
    if (!lastOpenedId) return rows;
    const nextRows = rows.map((row) =>
      row?.id === lastOpenedId
        ? { ...row, business_unread_count: 0 }
        : row
    );
    window.sessionStorage.removeItem("yb-last-opened-conversation");
    return nextRows;
  }, []);

  const loadConversations = useCallback(async () => {
    if (!userId || authStatus !== "authenticated") return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const nextConversations = await memoizeRequest(
        `business-conversations:${userId}`,
        async () => {
          const response = await retry(
            () =>
              fetchWithTimeout("/api/business/conversations", {
                method: "GET",
                credentials: "include",
                timeoutMs: 12000,
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
        }
      );

      if (requestId !== requestIdRef.current) return;
      setConversations(applyLocalRead(nextConversations));
      hasLoadedRef.current = true;
    } catch (err) {
      console.error("Failed to load conversations", err);
      if (requestId !== requestIdRef.current) return;
      setError("We couldn't load your messages. Please try again.");
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [applyLocalRead, authStatus, userId]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const handleVisibility = () => setIsVisible(!document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    if (!userId || authStatus !== "authenticated") return;
    if (!isVisible && hasLoadedRef.current) return;
    void loadConversations();
  }, [authStatus, isVisible, loadConversations, userId]);

  const buildConversationsChannel = useCallback(
    (activeClient) =>
      activeClient
        .channel(`conversations-business-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "conversations",
            filter: `business_id=eq.${userId}`,
          },
          () => {
            void loadConversations();
          }
        ),
    [loadConversations, userId]
  );

  useRealtimeChannel({
    supabase,
    enabled:
      !loadingUser &&
      authStatus === "authenticated" &&
      Boolean(userId),
    buildChannel: buildConversationsChannel,
    diagLabel: "business-conversations",
  });

  return (
    <div className="space-y-8">
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
            {conversations.length} chats
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-100 flex flex-wrap items-center justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              void loadConversations();
            }}
            className="rounded-full border border-rose-200/40 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-rose-100 hover:text-white"
          >
            Try again
          </button>
        </div>
      ) : null}

      <div className="mt-4 md:mt-6">
        <InboxList
          conversations={conversations}
          role="business"
          basePath="/business/messages"
          loading={showLoading}
        />
      </div>
    </div>
  );
}
