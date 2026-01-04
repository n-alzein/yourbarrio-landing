"use client";

const DEBUG_FLAG = "1";
const LS_KEY = "__yb_debug_nav_log__";
const MAX_EVENTS = 200;

const debugEnabled =
  typeof process !== "undefined" &&
  process.env?.NEXT_PUBLIC_DEBUG_NAV === DEBUG_FLAG;

const shouldDebug = () =>
  typeof window !== "undefined" &&
  process.env?.NEXT_PUBLIC_DEBUG_NAV === DEBUG_FLAG;

const safeStringify = (value) => {
  try {
    return JSON.stringify(value);
  } catch (err) {
    return String(value);
  }
};

const readFromStorage = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
};

const writeToStorage = (events) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(events));
  } catch (err) {
    // ignore
  }
};

let buffer = [];
let initialized = false;
let lastClick = null;
let blankCheckTimer = null;
let lastNavKind = null;

const appendEvent = (event) => {
  buffer.push(event);
  if (buffer.length > MAX_EVENTS) buffer = buffer.slice(-MAX_EVENTS);
  writeToStorage(buffer);
};

export const getDebugLog = () => {
  if (typeof window === "undefined") return [];
  return buffer.length ? buffer : readFromStorage();
};

export const clearDebugLog = () => {
  buffer = [];
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(LS_KEY);
  }
};

export const debugLog = (type, msg, data = {}) => {
  if (!shouldDebug()) return;
  const event = {
    ts: Date.now(),
    type,
    msg,
    data,
    href:
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "",
  };
  appendEvent(event);
  console.log("[DEBUG_NAV]", event);
};

export function initDebugNav() {
  if (!shouldDebug()) return;
  if (process.env.NODE_ENV === "production") return;
  if (initialized) return;
  initialized = true;
  lastNavKind = null;

  console.warn("[DEBUG_NAV] enabled", {
    buildTime: process.env.NEXT_PUBLIC_DEBUG_NAV,
  });

  // hydrate buffer from storage
  buffer = readFromStorage();

  const patchSummary = {
    fetch: false,
    historyPush: "skipped",
    historyReplace: "skipped",
    anchor: false,
    lifecycle: true,
    errors: true,
  };

  const safeRun = (fn, label) => {
    try {
      fn();
    } catch (err) {
      debugLog("patch-skip", label, { error: err?.message ?? err });
    }
  };

  /* ---------------------------------------------------------
     Global error handlers
  --------------------------------------------------------- */
  const handleError = (event) => {
    debugLog("error", "window.error", {
      message: event?.message,
      stack: event?.error?.stack,
    });
  };

  const handleRejection = (event) => {
    debugLog("error", "unhandledrejection", {
      reason: safeStringify(event?.reason),
    });
  };

  safeRun(() => window.addEventListener("error", handleError), "error-handler");
  safeRun(
    () => window.addEventListener("unhandledrejection", handleRejection),
    "rejection-handler"
  );

  /* ---------------------------------------------------------
     Visibility / unload
  --------------------------------------------------------- */
  const handleVisibility = () => {
    debugLog("visibility", "visibilitychange", {
      state: document.visibilityState,
      stack: new Error().stack,
    });
  };

  const handleBeforeUnload = () => {
    debugLog("lifecycle", "beforeunload", {
      stack: new Error().stack,
      lastClick,
    });
    if (lastClick && Date.now() - (lastClick.ts || 0) <= 250) {
      debugLog("nav-type", "hard-nav", { lastClick });
      lastNavKind = "hard-nav";
    }
  };

  const handlePageHide = (ev) => {
    debugLog("lifecycle", "pagehide", {
      persisted: ev?.persisted,
      stack: new Error().stack,
      lastClick,
    });
  };

  safeRun(
    () => document.addEventListener("visibilitychange", handleVisibility),
    "visibility"
  );
  safeRun(
    () => window.addEventListener("beforeunload", handleBeforeUnload),
    "beforeunload"
  );
  safeRun(
    () => window.addEventListener("pagehide", handlePageHide),
    "pagehide"
  );

  /* ---------------------------------------------------------
     Navigation tracing via history + popstate
  --------------------------------------------------------- */
  const getCurrentLocation = () =>
    `${window.location.pathname}${window.location.search}`;

  let lastNav = {
    path: getCurrentLocation(),
    ts: typeof performance !== "undefined" ? performance.now() : Date.now(),
  };

  const logTransition = (nextPath) => {
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const prev = lastNav;
    if (nextPath === prev.path) return;
    const durationMs = now - (prev.ts ?? now);
    debugLog("nav", "transition", {
      from: prev.path,
      to: nextPath,
      durationMs: Math.round(durationMs),
    });
    lastNav = { path: nextPath, ts: now };
    startBlankHeartbeat();
    if (!lastNavKind) {
      debugLog("nav-type", "spa-nav", { from: prev.path, to: nextPath });
      lastNavKind = "spa-nav";
    }
  };

  const patchHistoryMethod = (method, summaryKey) => {
    safeRun(() => {
      const desc = Object.getOwnPropertyDescriptor(window.history, method);
      if (desc && desc.writable !== false && desc.configurable !== false) {
        const original = window.history[method];
        window.history[method] = function patched(...args) {
          const result = original.apply(this, args);
          try {
            logTransition(getCurrentLocation());
          } catch (err) {
            debugLog("nav", "nav_wrap_error", { error: err?.message ?? err });
          }
          return result;
        };
        patchSummary[summaryKey] = "patched";
      } else {
        patchSummary[summaryKey] = "skipped";
      }
    }, `history-${method}`);
  };

  patchHistoryMethod("pushState", "historyPush");
  patchHistoryMethod("replaceState", "historyReplace");

  safeRun(() => {
    window.addEventListener("popstate", () => {
      try {
        logTransition(getCurrentLocation());
      } catch (err) {
        debugLog("nav", "nav_popstate_error", { error: err?.message ?? err });
      }
    });
  }, "popstate");

  /* ---------------------------------------------------------
     Anchor click tracing
  --------------------------------------------------------- */
  const findAnchor = (node) => {
    while (node && node !== document.documentElement) {
      if (node.tagName === "A") return node;
      node = node.parentElement;
    }
    return null;
  };

  const buildBreadcrumb = (node) => {
    const parts = [];
    let current = node;
    while (current && parts.length < 6) {
      const id = current.id ? `#${current.id}` : "";
      const classNames = current.className
        ? `.${String(current.className)
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .join(".")}`
        : "";
      parts.push(`${current.tagName}${id}${classNames}`);
      current = current.parentElement;
    }
    return parts;
  };

  const handleAnchorClick = (event) => {
    try {
      const anchor = event.target?.closest
        ? event.target.closest("a[href]")
        : findAnchor(event.target);
      if (anchor) {
        const href = anchor.getAttribute("href");
        if (href && !href.startsWith("#")) {
          const targetUrl = new URL(href, window.location.href);
          const currentOrigin = window.location.origin;
          if (targetUrl.origin === currentOrigin) {
            if (!event.defaultPrevented) {
              const outer = anchor.outerHTML || "";
              const breadcrumb = buildBreadcrumb(anchor);
              const datasetKeys = Object.keys(anchor.dataset || {});
              const parentDatasetKeys = Object.keys(
                anchor.parentElement?.dataset || {}
              );
              debugLog("anchor-click", "anchor", {
                href: targetUrl.href,
                target: anchor.getAttribute("target"),
                rel: anchor.getAttribute("rel"),
                defaultPrevented: event.defaultPrevented,
                metaKey: event.metaKey,
                ctrlKey: event.ctrlKey,
                shiftKey: event.shiftKey,
                altKey: event.altKey,
                button: event.button,
                outerHTML: outer.slice(0, 200),
                breadcrumb,
                datasetKeys,
                parentDatasetKeys,
                stack: new Error().stack,
              });
              lastClick = {
                ts: Date.now(),
                type: "anchor",
                href: targetUrl.href,
                target: anchor.getAttribute("target"),
                rel: anchor.getAttribute("rel"),
                outerHTML: outer.slice(0, 200),
                breadcrumb,
                datasetKeys,
                parentDatasetKeys,
              };
              startBlankHeartbeat();
            }
          }
        }
      }

      // Generic button/role=button tracing
      const el = event.target;
      const isButton =
        el?.tagName === "BUTTON" ||
        el?.getAttribute?.("role") === "button" ||
        el?.closest?.('[role="button"]');

      if (isButton) {
        const btn = el.closest ? el.closest("button,[role='button']") || el : el;
        const text = btn?.textContent || "";
        debugLog("click", "button", {
          tag: btn?.tagName,
          id: btn?.id,
          className: btn?.className,
          text: text.slice(0, 120),
          breadcrumb: buildBreadcrumb(btn),
          stack: new Error().stack,
        });
        lastClick = {
          ts: Date.now(),
          type: "button",
          tag: btn?.tagName,
          id: btn?.id,
          className: btn?.className,
          text: text.slice(0, 120),
          breadcrumb: buildBreadcrumb(btn),
        };
        startBlankHeartbeat();
      }
    } catch (err) {
      debugLog("click", "anchor-handler-error", { error: err?.message ?? err });
    }
  };

  safeRun(
    () => {
      document.addEventListener("click", handleAnchorClick, {
        capture: true,
        passive: true,
      });
      patchSummary.anchor = true;
    },
    "anchor-click"
  );

  /* ---------------------------------------------------------
     Fetch instrumentation (RSC + navigation-related)
  --------------------------------------------------------- */
  safeRun(() => {
    if (!window.__debugNavFetchPatched) {
      const originalFetch = window.fetch.bind(window);
      window.__debugNavOriginalFetch = originalFetch;

      window.fetch = async (...args) => {
        const start = performance.now();
        let url = "";
        let method = "GET";
        try {
          if (typeof args[0] === "string") {
            url = args[0];
          } else if (args[0]) {
            url = args[0].url || String(args[0]);
          }
          if (args[1]?.method) {
            method = args[1].method;
          } else if (args[0]?.method) {
            method = args[0].method;
          }
        } catch (err) {
          url = "[unreadable]";
        }

        const isRsc =
          url.includes("_rsc") ||
          url.includes("?_rsc=") ||
          url.includes("__flight__");

        try {
          const response = await originalFetch(...args);
          const duration = performance.now() - start;

          if (isRsc || response.status >= 400) {
            let preview = "";
            if (response.status >= 400) {
              try {
                const clone = response.clone();
                const text = await clone.text();
                preview = text.slice(0, 200);
              } catch (err) {
                preview = `[body read failed: ${err?.message ?? err}]`;
              }
            }

            debugLog("fetch", "response", {
              method,
              url,
              status: response.status,
              redirected: response.redirected,
              durationMs: Math.round(duration),
              isRsc,
              preview,
            });
          }

          return response;
        } catch (err) {
          const duration = performance.now() - start;
          debugLog("fetch", "error", {
            method,
            url,
            durationMs: Math.round(duration),
            error: err?.message ?? err,
          });
          throw err;
        }
      };

      window.__debugNavFetchPatched = true;
      patchSummary.fetch = true;
    }
  }, "fetch");

  debugLog("lifecycle", "initialized", { patches: patchSummary });
}

/* ---------------------------------------------------------
   Blank page heartbeat detector (debug only)
--------------------------------------------------------- */
function startBlankHeartbeat() {
  if (!shouldDebug()) return;
  if (blankCheckTimer) {
    clearInterval(blankCheckTimer);
    blankCheckTimer = null;
  }

  const started = Date.now();
  blankCheckTimer = setInterval(() => {
    if (Date.now() - started > 10000) {
      clearInterval(blankCheckTimer);
      blankCheckTimer = null;
      return;
    }

    try {
      const root = document.getElementById("__next") || document.body;
      const children = root ? root.children?.length || 0 : 0;
      const styles = root
        ? window.getComputedStyle(root)
        : { display: null, opacity: null, visibility: null };
      const hiddenStyle =
        styles?.display === "none" ||
        styles?.visibility === "hidden" ||
        styles?.opacity === "0";

      if (root && (children === 0 || hiddenStyle)) {
        debugLog("blank-check", "root-state", {
          children,
          display: styles?.display,
          opacity: styles?.opacity,
          visibility: styles?.visibility,
          stack: new Error().stack,
        });
        clearInterval(blankCheckTimer);
        blankCheckTimer = null;
      }
    } catch (err) {
      debugLog("blank-check", "error", { error: err?.message ?? err });
      clearInterval(blankCheckTimer);
      blankCheckTimer = null;
    }
  }, 500);
}

export function logAuthTelemetry(snapshot) {
  if (!shouldDebug()) return;
  debugLog("auth", "state", snapshot);
}

export function logLogout(reason) {
  if (!shouldDebug()) return;
  debugLog("auth", "logout", {
    reason,
  });
}

export function debugNavEnabled() {
  return debugEnabled;
}
