import { useEffect, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { subscribeIfSession } from "@/lib/realtime/subscribeIfSession";

export function useRealtimeChannel({
  supabase,
  enabled = true,
  buildChannel,
  diagLabel = "",
}) {
  const channelRef = useRef(null);
  const clientRef = useRef(null);
  const retryTimerRef = useRef(null);
  const idleHandleRef = useRef(null);
  const attemptsRef = useRef(0);
  const lastStatusRef = useRef(null);
  const startSeqRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (typeof buildChannel !== "function") return undefined;

    let cancelled = false;

    const clearRetryTimer = () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    const cancelIdle = () => {
      if (idleHandleRef.current && "cancelIdleCallback" in window) {
        try {
          window.cancelIdleCallback(idleHandleRef.current);
        } catch {
          // best effort
        }
      }
      idleHandleRef.current = null;
    };

    const cleanupChannel = () => {
      const channel = channelRef.current;
      const client = clientRef.current;
      channelRef.current = null;
      if (channel && client) {
        try {
          client.removeChannel(channel);
        } catch {
          // best effort
        }
      }
      channelRef.current = null;
    };

    const cleanupAll = () => {
      cancelled = true;
      clearRetryTimer();
      cancelIdle();
      cleanupChannel();
      attemptsRef.current = 0;
    };

    if (!enabled) {
      cleanupAll();
      return undefined;
    }

    const seq = ++startSeqRef.current;

    const logStatus = (status, err) => {
      if (process.env.NODE_ENV !== "development") return;
      if (process.env.NEXT_PUBLIC_DEBUG_NAV_PERF !== "1") return;
      if (lastStatusRef.current === status) return;
      lastStatusRef.current = status;
      console.debug("[realtime] status", {
        label: diagLabel,
        status,
        message: err?.message || null,
      });
    };

    const schedule = (delayMs) => {
      clearRetryTimer();
      if (cancelled) return;
      retryTimerRef.current = setTimeout(() => deferIdle(start), delayMs);
    };

    const deferIdle = (fn) => {
      if (cancelled) return;
      if ("requestIdleCallback" in window) {
        idleHandleRef.current = window.requestIdleCallback(fn, { timeout: 2000 });
      } else {
        retryTimerRef.current = setTimeout(fn, 0);
      }
    };

    const handleStatus = (status, err) => {
      if (cancelled) return;
      if (startSeqRef.current !== seq) return;
      logStatus(status, err);
      if (status === "SUBSCRIBED") {
        attemptsRef.current = 0;
        return;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        if (attemptsRef.current >= 5) return;
        attemptsRef.current += 1;
        const backoff = Math.min(30000, 1000 * 2 ** (attemptsRef.current - 1));
        schedule(backoff);
      }
    };

    const start = async () => {
      if (cancelled) return;
      if (startSeqRef.current !== seq) return;
      cleanupChannel();
      clientRef.current = supabase ?? getSupabaseBrowserClient();
      if (!clientRef.current) return;
      const channel = await subscribeIfSession(
        clientRef.current,
        buildChannel,
        diagLabel,
        handleStatus
      );
      if (cancelled || startSeqRef.current !== seq) {
        if (channel && clientRef.current) {
          try {
            clientRef.current.removeChannel(channel);
          } catch {
            // best effort
          }
        }
        return;
      }
      channelRef.current = channel;
    };

    deferIdle(start);

    return cleanupAll;
  }, [enabled, supabase, buildChannel, diagLabel]);
}
