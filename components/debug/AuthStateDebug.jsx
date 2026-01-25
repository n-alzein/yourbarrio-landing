"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function AuthStateDebug() {
  const { authStatus, user, profile, lastAuthEvent, lastError } = useAuth();
  const hasSession = authStatus === "authenticated";
  const hasUser = Boolean(user || profile);
  const [sessionInfo, setSessionInfo] = useState({
    sessionUserId: null,
    expiresAt: null,
    expiresInSec: null,
    hasAccessToken: false,
  });

  useEffect(() => {
    let active = true;
    const client = getSupabaseBrowserClient();
    if (!client) return undefined;

    const loadSession = async () => {
      try {
        const { data } = await client.auth.getSession();
        const session = data?.session ?? null;
        if (!active) return;
        const expiresAt = session?.expires_at ?? null;
        const expiresInSec = expiresAt
          ? Math.max(0, Math.round(expiresAt - Date.now() / 1000))
          : null;
        setSessionInfo({
          sessionUserId: session?.user?.id ?? null,
          expiresAt,
          expiresInSec,
          hasAccessToken: Boolean(session?.access_token),
        });
      } catch {
        if (!active) return;
        setSessionInfo({
          sessionUserId: null,
          expiresAt: null,
          expiresInSec: null,
          hasAccessToken: false,
        });
      }
    };

    loadSession();
    const interval = setInterval(loadSession, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div
      className="fixed bottom-4 right-4 z-[9000] rounded-xl border border-white/10 bg-black/80 px-3 py-2 text-[11px] text-white/80 shadow-xl backdrop-blur"
      aria-live="polite"
    >
      <div>status: {authStatus}</div>
      <div>hasSession: {hasSession ? "yes" : "no"}</div>
      <div>hasUser: {hasUser ? "yes" : "no"}</div>
      <div>sessionUserId: {sessionInfo.sessionUserId || "n/a"}</div>
      <div>tokenExpiresIn: {sessionInfo.expiresInSec ?? "n/a"}s</div>
      <div>hasAccessToken: {sessionInfo.hasAccessToken ? "yes" : "no"}</div>
      <div>lastAuthEvent: {lastAuthEvent || "n/a"}</div>
      <div>lastError: {lastError || "n/a"}</div>
    </div>
  );
}
