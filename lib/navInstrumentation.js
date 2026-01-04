"use client";

let installed = false;

export function installHomeNavInstrumentation({ enabled } = {}) {
  if (installed) return;
  if (!enabled) return;
  if (typeof window === "undefined") return;
  if (!window.location?.pathname?.startsWith("/customer/home")) return;
  installed = true;

  const safeLog = (payload) => {
    try {
      // eslint-disable-next-line no-console
      console.log("[HOME_NAV_INSTRUMENTATION]", payload);
    } catch {
      /* ignore */
    }
  };

  const wrapHistory = (method) => {
    const original = window.history[method];
    if (typeof original !== "function") return;
    window.history[method] = function wrappedHistory(...args) {
      safeLog({
        method: `history.${method}`,
        args: (() => {
          try {
            return JSON.parse(JSON.stringify(args));
          } catch {
            return String(args);
          }
        })(),
        href: window.location.href,
        stack: new Error().stack,
      });
      return original.apply(this, args);
    };
  };

  const wrapLocation = (method) => {
    const original = window.location[method];
    if (typeof original !== "function") return;
    window.location[method] = function wrappedLocation(...args) {
      safeLog({
        method: `location.${method}`,
        args: (() => {
          try {
            return JSON.parse(JSON.stringify(args));
          } catch {
            return String(args);
          }
        })(),
        href: window.location.href,
        stack: new Error().stack,
      });
      return original.apply(this, args);
    };
  };

  wrapHistory("pushState");
  wrapHistory("replaceState");
  wrapLocation("assign");
  wrapLocation("replace");
}
