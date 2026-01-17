"use client";

const AUTH_DIAG_FLAG = "1";
const SESSION_LABELS = {
  token: "token",
  user: "user",
  other: "other",
};

const enabled =
  typeof process !== "undefined" &&
  process.env?.NEXT_PUBLIC_AUTH_DIAG === AUTH_DIAG_FLAG;

let initialized = false;
let totalCalls = 0;
let endpointCounts = {
  [SESSION_LABELS.token]: 0,
  [SESSION_LABELS.user]: 0,
  [SESSION_LABELS.other]: 0,
};
let listeners = new Set();

const notify = () => {
  const snapshot = getAuthDiagSnapshot();
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (err) {
      // ignore listener errors
    }
  });
};

const classifyEndpoint = (pathname) => {
  if (pathname.includes("/token")) return SESSION_LABELS.token;
  if (pathname.includes("/user")) return SESSION_LABELS.user;
  return SESSION_LABELS.other;
};

const buildRoute = () => {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search}`;
};

export function authDiagEnabled() {
  return enabled;
}

export function getAuthDiagSnapshot() {
  return {
    total: totalCalls,
    endpoints: { ...endpointCounts },
  };
}

export function subscribeAuthDiag(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function initAuthDiagnostics() {
  if (!enabled || typeof window === "undefined") return;
  if (initialized) return;
  initialized = true;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const authBase = supabaseUrl.replace(/\/$/, "") + "/auth/v1/";
  if (!authBase || authBase === "/auth/v1/") return;

  const originalFetch = window.fetch?.bind(window);
  if (!originalFetch) return;

  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input?.url;
    const method =
      init?.method ||
      (typeof input === "object" && input?.method) ||
      "GET";

    if (typeof url === "string" && url.startsWith(authBase)) {
      const pathname = new URL(url).pathname;
      const endpointKey = classifyEndpoint(pathname);
      totalCalls += 1;
      endpointCounts[endpointKey] += 1;

      const logPayload = {
        path: pathname,
        method,
        timestamp: new Date().toISOString(),
        route: buildRoute(),
        totalCalls,
      };

      if (process.env.NODE_ENV === "development") {
        logPayload.stack = new Error().stack;
      }

      // eslint-disable-next-line no-console
      console.log("[AUTH_DIAG]", logPayload);
      notify();
    }

    return originalFetch(input, init);
  };
}
