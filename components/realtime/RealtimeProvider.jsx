"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { stopRealtime } from "@/lib/realtimeManager";
import { isLogoutInFlight } from "@/lib/auth/logout";

export default function RealtimeProvider({ children }) {
  const { supabase, authStatus, lastAuthEvent } = useAuth();
  const signedOutCleanupRef = useRef(false);

  useEffect(() => {
    if (!supabase) return;
    const signedOut =
      authStatus === "unauthenticated" || lastAuthEvent === "SIGNED_OUT";
    if (!signedOut) {
      signedOutCleanupRef.current = false;
      return;
    }
    if (signedOutCleanupRef.current) return;
    signedOutCleanupRef.current = true;
    void stopRealtime(supabase);
  }, [authStatus, lastAuthEvent, supabase]);

  useEffect(() => {
    return () => {
      if (!supabase || isLogoutInFlight()) return;
      void stopRealtime(supabase);
    };
  }, [supabase]);

  return children;
}
