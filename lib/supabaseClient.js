// lib/supabaseClient.js
import { createBrowserClient } from "@supabase/ssr";

let supabase = null;
let getSessionPromise = null;
let refreshSessionPromise = null;
let tokenRequestPromise = null;
let authCooldownUntil = 0;
let authBackoffMs = 0;
let authInvalidTokenAt = 0;
const authGuardListeners = new Set();

const AUTH_BACKOFF_BASE_MS = 30000;
const AUTH_BACKOFF_MAX_MS = 60000;

const authDiagEnabled = () => process.env.NEXT_PUBLIC_AUTH_DIAG === "1";

function notifyAuthGuard() {
  const snapshot = getAuthGuardState();
  authGuardListeners.forEach((listener) => listener(snapshot));
}

export function subscribeAuthGuard(listener) {
  authGuardListeners.add(listener);
  return () => {
    authGuardListeners.delete(listener);
  };
}

export function getAuthGuardState() {
  const now = Date.now();
  return {
    cooldownUntil: authCooldownUntil,
    cooldownMsRemaining: Math.max(0, authCooldownUntil - now),
    backoffMs: authBackoffMs,
    tokenInvalidAt: authInvalidTokenAt,
  };
}

export function acknowledgeAuthTokenInvalid(tokenInvalidAt) {
  if (authInvalidTokenAt && authInvalidTokenAt <= tokenInvalidAt) {
    authInvalidTokenAt = 0;
    notifyAuthGuard();
  }
}

function setAuthCooldown(status, url) {
  const now = Date.now();
  const nextBackoff = authBackoffMs
    ? Math.min(AUTH_BACKOFF_MAX_MS, authBackoffMs * 2)
    : AUTH_BACKOFF_BASE_MS;
  const jitter = Math.floor(nextBackoff * (0.2 * Math.random()));
  authBackoffMs = nextBackoff;
  authCooldownUntil = now + nextBackoff + jitter;
  if (authDiagEnabled()) {
    console.warn("[AUTH_DIAG] auth token rate limited", {
      status,
      url,
      cooldownMs: authCooldownUntil - now,
    });
  }
  notifyAuthGuard();
}

function clearAuthCooldown() {
  if (!authCooldownUntil && !authBackoffMs) return;
  authCooldownUntil = 0;
  authBackoffMs = 0;
  notifyAuthGuard();
}

function markAuthTokenInvalid(status, url) {
  authInvalidTokenAt = Date.now();
  if (authDiagEnabled()) {
    console.warn("[AUTH_DIAG] auth token invalid", { status, url });
  }
  notifyAuthGuard();
}

function isAuthCooldownActive() {
  return Date.now() < authCooldownUntil;
}

function authDiagLog(label, payload = {}) {
  if (!authDiagEnabled() || typeof window === "undefined") return;
  const timestamp = new Date().toISOString();
  console.log("[AUTH_DIAG]", {
    timestamp,
    pathname: window.location.pathname,
    search: window.location.search,
    label,
    ...payload,
  });
}

function createSupabaseFetch() {
  const baseFetch = (...args) => fetch(...args);
  return async (input, init) => {
    const url = typeof input === "string" ? input : input?.url;
    const urlString = url ? String(url) : "";
    const isTokenRequest =
      urlString.includes("/auth/v1/token") || urlString.includes("token");

    if (isTokenRequest) {
      if (authDiagEnabled()) {
        authDiagLog("fetch:token", {
          url: urlString,
          stack: new Error().stack,
        });
      }

      if (isAuthCooldownActive()) {
        const cooldown = getAuthGuardState();
        return new Response(
          JSON.stringify({ error: "rate_limited", retry_after_ms: cooldown.cooldownMsRemaining }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(Math.ceil(cooldown.cooldownMsRemaining / 1000)),
            },
          }
        );
      }

      if (tokenRequestPromise) {
        return tokenRequestPromise;
      }

      tokenRequestPromise = baseFetch(input, init)
        .then((response) => {
          if (response.status === 429) {
            setAuthCooldown(response.status, urlString);
          } else if (response.status === 400) {
            markAuthTokenInvalid(response.status, urlString);
            setAuthCooldown(response.status, urlString);
          } else if (response.ok) {
            clearAuthCooldown();
          }
          return response;
        })
        .catch((err) => {
          if (authDiagEnabled()) {
            authDiagLog("fetch:token:error", {
              url: urlString,
              message: err?.message || String(err),
            });
          }
          throw err;
        })
        .finally(() => {
          tokenRequestPromise = null;
        });

      return tokenRequestPromise;
    }

    return baseFetch(input, init);
  };
}

export function getCookieName() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return undefined;
  return `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
}

export function resetSupabaseClient() {
  console.log("Resetting Supabase client singleton");
  supabase = null;
}

export function getBrowserSupabaseClient() {
  if (typeof window === "undefined") return null;

  if (!supabase) {
    try {
      supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
          },
          global: {
            fetch: createSupabaseFetch(),
          },
        }
      );

      const originalGetSession = supabase.auth.getSession.bind(supabase.auth);
      supabase.auth.getSession = async (...args) => {
        if (getSessionPromise) return getSessionPromise;
        authDiagLog("auth:getSession", {
          stack: new Error().stack,
        });
        getSessionPromise = originalGetSession(...args).finally(() => {
          getSessionPromise = null;
        });
        return getSessionPromise;
      };

      if (typeof supabase.auth.refreshSession === "function") {
        const originalRefreshSession = supabase.auth.refreshSession.bind(
          supabase.auth
        );
        supabase.auth.refreshSession = async (...args) => {
          if (refreshSessionPromise) return refreshSessionPromise;
          authDiagLog("auth:refreshSession", {
            stack: new Error().stack,
          });
          refreshSessionPromise = originalRefreshSession(...args).finally(() => {
            refreshSessionPromise = null;
          });
          return refreshSessionPromise;
        };
      }

      const originalGetUser = supabase.auth.getUser.bind(supabase.auth);
      supabase.auth.getUser = async (...args) => {
        authDiagLog("auth:getUser", { stack: new Error().stack });
        return originalGetUser(...args);
      };

      const wrapAuthMethod = (name) => {
        const original = supabase.auth[name]?.bind(supabase.auth);
        if (!original) return;
        supabase.auth[name] = async (...args) => {
          authDiagLog(`auth:${name}`, { stack: new Error().stack });
          return original(...args);
        };
      };

      [
        "exchangeCodeForSession",
        "signInWithOAuth",
        "signInWithPassword",
        "signUp",
      ].forEach(wrapAuthMethod);
    } catch (err) {
      console.error("Failed to initialize Supabase browser client", err);
      return null;
    }
  }

  return supabase;
}

export function getFreshBrowserSupabaseClient() {
  if (authDiagEnabled()) {
    authDiagLog("auth:client:reuse", {
      message: "Fresh client requested; returning singleton to avoid refresh loops.",
    });
  }
  return getBrowserSupabaseClient();
}
