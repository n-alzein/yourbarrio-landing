"use client";

import { useAuth } from "@/components/AuthProvider";

export default function AuthStateDebug() {
  const { authStatus, user, profile, lastAuthEvent, lastError } = useAuth();
  const hasSession = authStatus === "authenticated";
  const hasUser = Boolean(user || profile);

  return (
    <div
      className="fixed bottom-4 right-4 z-[9000] rounded-xl border border-white/10 bg-black/80 px-3 py-2 text-[11px] text-white/80 shadow-xl backdrop-blur"
      aria-live="polite"
    >
      <div>status: {authStatus}</div>
      <div>hasSession: {hasSession ? "yes" : "no"}</div>
      <div>hasUser: {hasUser ? "yes" : "no"}</div>
      <div>lastAuthEvent: {lastAuthEvent || "n/a"}</div>
      <div>lastError: {lastError || "n/a"}</div>
    </div>
  );
}
