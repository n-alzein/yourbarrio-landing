import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { subscribeIfSession } from "@/lib/realtime/subscribeIfSession";

export function useRealtimeChannel({
  supabase,
  enabled = true,
  buildChannel,
  diagLabel = "",
}) {
  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof window === "undefined") return undefined;
    if (typeof buildChannel !== "function") return undefined;

    let cancelled = false;
    let channel = null;
    let client = null;
    const timer = setTimeout(() => {
      if (cancelled) return;
      (async () => {
        client = supabase ?? getSupabaseBrowserClient();
        if (!client) return;
        channel = await subscribeIfSession(
          client,
          buildChannel,
          diagLabel,
          (status, err) => {
            if (process.env.NODE_ENV !== "development") return;
            console.debug("[realtime] status", {
              label: diagLabel,
              status,
              message: err?.message || null,
            });
          }
        );
        if (cancelled && channel && client) {
          try {
            client.removeChannel(channel);
          } catch {
            // best effort
          }
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (channel && client) {
        try {
          client.removeChannel(channel);
        } catch {
          // best effort
        }
      }
    };
  }, [enabled, supabase, buildChannel, diagLabel]);
}
