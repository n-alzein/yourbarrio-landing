"use client";

import { stopRealtime } from "@/lib/realtimeManager";

let logoutPromise = null;
let logoutRedirectInFlight = false;

function isProtectedPath(pathname) {
  if (!pathname) return false;
  if (pathname.startsWith("/customer")) return true;
  if (pathname.startsWith("/account")) return true;
  if (pathname.startsWith("/checkout")) return true;
  if (pathname.startsWith("/orders")) return true;
  if (pathname.startsWith("/business/")) return true;
  return false;
}

function withLoggedOutParam(pathname) {
  const url = new URL(pathname || "/", "http://localhost");
  if (!url.searchParams.has("loggedOut")) {
    url.searchParams.set("loggedOut", "1");
  }
  return `${url.pathname}${url.search}`;
}

export function resolveLogoutRedirect({ role, redirectTo } = {}) {
  const fallback = role === "business" ? "/business?loggedOut=1" : "/?loggedOut=1";
  if (!redirectTo || typeof redirectTo !== "string") return fallback;

  let parsed;
  try {
    parsed = new URL(redirectTo, "http://localhost");
  } catch {
    return fallback;
  }

  const candidate = `${parsed.pathname}${parsed.search}`;
  if (isProtectedPath(parsed.pathname)) return fallback;
  return withLoggedOutParam(candidate);
}

export async function cleanupSupabaseRealtime(supabase) {
  await stopRealtime(supabase);
}

export async function signOutLocalSession(supabase, scope = "local") {
  if (!supabase?.auth?.signOut) return;
  await cleanupSupabaseRealtime(supabase);
  try {
    await supabase.auth.signOut({ scope });
  } catch {
    // best effort
  }
}

export function isLogoutRedirectInFlight() {
  return logoutRedirectInFlight;
}

export function isLogoutInFlight() {
  return Boolean(logoutPromise) || logoutRedirectInFlight;
}

export async function performLogout({
  supabase,
  role,
  redirectTo,
  callServerSignout = true,
} = {}) {
  if (logoutPromise) return logoutPromise;

  const target = resolveLogoutRedirect({ role, redirectTo });
  logoutPromise = (async () => {
    await signOutLocalSession(supabase, "local");
    if (callServerSignout && typeof window !== "undefined") {
      try {
        await fetch("/api/auth/signout", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
      } catch {
        // best effort
      }
    }
    if (typeof window !== "undefined") {
      logoutRedirectInFlight = true;
      window.location.assign(target);
    }
    return target;
  })().finally(() => {
    logoutPromise = null;
  });

  return logoutPromise;
}
