import { useEffect, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { subscribeIfSession } from "@/lib/realtime/subscribeIfSession";
import {
  cancelRealtimeRetry,
  isRealtimePaused,
  logRealtimePerf,
  noteRealtimeReconnectAttempt,
  noteRealtimeSubscribeAttempt,
  registerChannel,
  resetRealtimeRetry,
  scheduleRealtimeRetry,
  subscribeRealtimeVisibility,
  unregisterChannel,
} from "@/lib/realtimeManager";

export function useRealtimeChannel({
  supabase,
  enabled = true,
  buildChannel,
  diagLabel = "",
}) {
  const channelRef = useRef(null);
  const clientRef = useRef(null);
  const idleHandleRef = useRef(null);
  const idleTimerRef = useRef(null);
  const lastStatusRef = useRef(null);
  const startSeqRef = useRef(0);
  const startInFlightRef = useRef(false);
  const keyRef = useRef(
    diagLabel || `realtime-${Math.random().toString(36).slice(2, 10)}`
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (typeof buildChannel !== "function") return undefined;

    let cancelled = false;
    const key = diagLabel || keyRef.current;
    keyRef.current = key;

    const cancelIdle = () => {
      if (idleHandleRef.current && "cancelIdleCallback" in window) {
        try {
          window.cancelIdleCallback(idleHandleRef.current);
        } catch {
          // best effort
        }
      }
      idleHandleRef.current = null;
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
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
      if (channel) {
        unregisterChannel(channel);
        logRealtimePerf("unsubscribe", { label: diagLabel });
      }
      channelRef.current = null;
    };

    const cleanupAll = () => {
      cancelled = true;
      cancelIdle();
      cleanupChannel();
      cancelRealtimeRetry(key);
    };

    if (!enabled) {
      resetRealtimeRetry(key);
      cleanupAll();
      return undefined;
    }

    const seq = ++startSeqRef.current;

    const isSuspensionError = (err) => {
      const message = err?.message || err?.reason || "";
      return String(message).toLowerCase().includes("suspension");
    };

    const logStatus = (status, err) => {
      if (process.env.NODE_ENV !== "development") return;
      if (process.env.NEXT_PUBLIC_DEBUG_NAV_PERF !== "1") return;
      if (isSuspensionError(err)) return;
      if (lastStatusRef.current === status) return;
      lastStatusRef.current = status;
      console.debug("[realtime] status", {
        label: diagLabel,
        status,
        message: err?.message || null,
      });
    };

    const deferIdle = (fn) => {
      if (cancelled) return;
      if ("requestIdleCallback" in window) {
        idleHandleRef.current = window.requestIdleCallback(fn, { timeout: 2000 });
      } else {
        idleTimerRef.current = setTimeout(fn, 0);
      }
    };

    const handleStatus = (status, err) => {
      if (cancelled) return;
      if (startSeqRef.current !== seq) return;
      logStatus(status, err);
      if (status === "SUBSCRIBED") {
        resetRealtimeRetry(key);
        logRealtimePerf("subscribe_success", { label: diagLabel });
        return;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        if (isRealtimePaused()) return;
        const meta = scheduleRealtimeRetry({
          key,
          callback: () => deferIdle(start),
          bumpAttempts: true,
        });
        if (!meta || meta.exhausted || !meta.scheduled) return;
        noteRealtimeReconnectAttempt();
        logRealtimePerf("reconnect_scheduled", {
          label: diagLabel,
          status,
          delayMs: meta.delayMs,
          attempts: meta.attempts,
          suspension: isSuspensionError(err),
        });
      }
    };

    const start = async () => {
      if (cancelled) return;
      if (startSeqRef.current !== seq) return;
      if (startInFlightRef.current) return;
      if (isRealtimePaused()) return;
      startInFlightRef.current = true;
      cleanupChannel();
      clientRef.current = supabase ?? getSupabaseBrowserClient();
      try {
        if (!clientRef.current) {
          return;
        }
        noteRealtimeSubscribeAttempt();
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
        if (channel) {
          channelRef.current = registerChannel(channel);
        }
      } finally {
        startInFlightRef.current = false;
      }
    };

    const scheduleResume = (delayMs = 250) => {
      scheduleRealtimeRetry({
        key,
        callback: () => deferIdle(start),
        bumpAttempts: false,
        delayMs,
      });
    };

    const unsubscribeVisibility = subscribeRealtimeVisibility((state) => {
      if (cancelled) return;
      if (state.paused) {
        cancelRealtimeRetry(key);
        cleanupChannel();
        return;
      }
      scheduleResume(300);
    });

    deferIdle(start);

    return () => {
      unsubscribeVisibility?.();
      cleanupAll();
    };
  }, [enabled, supabase, buildChannel, diagLabel]);
}
