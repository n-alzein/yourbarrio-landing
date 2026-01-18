"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const NAV_TRACE_ENABLED =
  process.env.NEXT_PUBLIC_NAV_TRACE === "1" ||
  process.env.NEXT_PUBLIC_CLICK_DIAG === "1";

function safePatch(label, target, key, wrapperFactory, statusMap) {
  try {
    let owner = target;
    let desc = Object.getOwnPropertyDescriptor(owner, key);
    while (!desc && owner && Object.getPrototypeOf(owner)) {
      owner = Object.getPrototypeOf(owner);
      desc = Object.getOwnPropertyDescriptor(owner, key);
    }
    if (!desc) {
      console.warn("[NAV_TRACE] patch skipped", { label, key, reason: "missing descriptor" });
      if (statusMap) statusMap[label] = "skipped";
      return null;
    }
    const writable = desc.writable !== false || typeof desc.set === "function";
    const configurable = desc.configurable !== false;
    if (!writable || !configurable) {
      console.warn("[NAV_TRACE] patch skipped", {
        label,
        key,
        reason: "readonly or non-configurable",
        descriptor: desc,
      });
      if (statusMap) statusMap[label] = "skipped";
      return null;
    }
    const original = owner[key];
    const patched = wrapperFactory(original);
    owner[key] = patched;
    if (statusMap) statusMap[label] = "patched";
    return () => {
      try {
        owner[key] = original;
      } catch {
        /* ignore */
      }
    };
  } catch (err) {
    console.warn("[NAV_TRACE] patch skipped", { label, key, reason: `${err}` });
    if (statusMap) statusMap[label] = "skipped";
    return null;
  }
}

function describeNode(node) {
  if (!node) return "null";
  if (node === document) return "document";
  if (node === window) return "window";
  if (!node.tagName) return node.nodeName || "unknown";
  const tag = node.tagName.toLowerCase();
  const id = node.id ? `#${node.id}` : "";
  const cls = (node.className || "").toString().split(/\s+/).filter(Boolean).slice(0, 2);
  const data = node.dataset?.clickdiag ? `[${node.dataset.clickdiag}]` : "";
  return `${tag}${id}${cls.length ? `.${cls.join(".")}` : ""}${data}`;
}

export default function NavTrace() {
  const pathname = usePathname();
  const instanceId = useRef(
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `navtrace-${Date.now()}-${Math.random()}`
  );
  const lastHrefRef = useRef(typeof window !== "undefined" ? window.location.href : "");
  const lastChangeRef = useRef({ href: lastHrefRef.current, ts: Date.now() });
  const pollTimerRef = useRef(null);
  const bodyObserverRef = useRef(null);
  const mountedRef = useRef(false);
  const isActiveInstance = () =>
    NAV_TRACE_ENABLED &&
    typeof window !== "undefined" &&
    window.__NAV_TRACE_ACTIVE__ === instanceId.current;

  useEffect(() => {
    if (!isActiveInstance() || typeof window === "undefined") return undefined;
    if (window.__NAV_TRACE_ACTIVE__ && window.__NAV_TRACE_ACTIVE__ !== instanceId.current) return undefined;
    const onErr = (event) => {
      try {
        console.error("[NAV_TRACE] RUNTIME_ERROR", {
          type: "error",
          message: event?.message || event?.reason || "unknown",
          href: window.location.href,
          pathname: window.location.pathname,
          stack: event?.error?.stack || event?.reason?.stack || null,
        });
      } catch {
        /* ignore */
      }
    };
    const onRej = (event) => {
      try {
        console.error("[NAV_TRACE] RUNTIME_ERROR", {
          type: "unhandledrejection",
          message: event?.reason ? `${event.reason}` : "unhandled rejection",
          href: window.location.href,
          pathname: window.location.pathname,
          stack: event?.reason?.stack || null,
        });
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);

    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, []);

  useEffect(() => {
    if (!NAV_TRACE_ENABLED || typeof window === "undefined") return undefined;
    if (window.__NAV_TRACE_ACTIVE__ && window.__NAV_TRACE_ACTIVE__ !== instanceId.current) return undefined;
    window.__NAV_TRACE_ACTIVE__ = instanceId.current;
    mountedRef.current = true;
    console.log("[NAV_TRACE] mounted", { href: window.location.href });
    return undefined;
  }, []);

  useEffect(() => {
    if (!isActiveInstance()) return undefined;
    if (pathname) {
      console.log("[NAV_TRACE] pathname change", { pathname, href: window.location.href, ts: Date.now() });
    }
    return undefined;
  }, [pathname]);

  useEffect(() => {
    if (!isActiveInstance()) return undefined;

    const patchStatus = {
      pushState: "skipped",
      replaceState: "skipped",
    };
    const unpatches = [];
    const patchWrapper = (label) => (original) =>
      function patched(...args) {
        console.groupCollapsed("[NAV_TRACE] push/replace", label);
        console.log({
          from: window.location.href,
          args,
          ts: Date.now(),
          stack: new Error().stack,
        });
        console.groupEnd();
        return original?.apply?.(this, args);
      };

    const pushUnpatch = safePatch("pushState", history, "pushState", patchWrapper("pushState"), patchStatus);
    if (pushUnpatch) unpatches.push(pushUnpatch);
    const replaceUnpatch = safePatch(
      "replaceState",
      history,
      "replaceState",
      patchWrapper("replaceState"),
      patchStatus
    );
    if (replaceUnpatch) unpatches.push(replaceUnpatch);

    const onPop = (event) => {
      try {
        console.log("[NAV_TRACE] popstate", { state: event.state, href: window.location.href, ts: Date.now() });
      } catch (err) {
        console.warn("[NAV_TRACE] popstate log error", err);
      }
    };
    const onHash = (event) => {
      try {
        console.log("[NAV_TRACE] hashchange", { oldURL: event.oldURL, newURL: event.newURL, ts: Date.now() });
      } catch (err) {
        console.warn("[NAV_TRACE] hashchange log error", err);
      }
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("hashchange", onHash);
    console.log("[NAV_TRACE] patch status", patchStatus);

    return () => {
      unpatches.forEach((fn) => {
        try {
          fn();
        } catch {
          /* ignore */
        }
      });
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  useEffect(() => {
    if (!isActiveInstance() || typeof document === "undefined") return undefined;

    const logEvent = (phase) => (event) => {
      try {
        const link = event.target?.closest?.("a[href]");
        const path = typeof event.composedPath === "function" ? event.composedPath() : [];
        const payload = {
          type: event.type,
          phase,
          defaultPrevented: event.defaultPrevented,
          cancelBubble: event.cancelBubble,
          eventPhase: event.eventPhase,
          target: describeNode(event.target),
          currentTarget: describeNode(event.currentTarget),
          href: link?.getAttribute?.("href") || null,
          path: path.slice(0, 6).map(describeNode),
          ts: Date.now(),
        };
        queueMicrotask(() => {
          try {
            console.groupCollapsed("[NAV_TRACE] EVENT", phase, event.type);
            console.log(payload);
            console.groupEnd();
            if (payload.href && payload.defaultPrevented) {
              console.warn("[NAV_TRACE] defaultPrevented observed (read-only)", {
                href: payload.href,
                phase,
                type: event.type,
                stack: new Error().stack,
              });
            }
          } catch (err) {
            console.warn("[NAV_TRACE] EVENT log error", err);
          }
        });
      } catch (err) {
        console.warn("[NAV_TRACE] EVENT handler error", err);
      }
    };

    const capture = logEvent("capture");
    const bubble = logEvent("bubble");
    const types = ["click", "pointerdown", "pointerup", "submit"];
    types.forEach((t) => {
      document.addEventListener(t, capture, { capture: true, passive: true });
      document.addEventListener(t, bubble, { passive: true });
    });

    return () => {
      types.forEach((t) => {
        document.removeEventListener(t, capture, { capture: true, passive: true });
        document.removeEventListener(t, bubble, { passive: true });
      });
    };
  }, []);

  useEffect(() => {
    if (!NAV_TRACE_ENABLED || typeof window === "undefined") return undefined;

    const detectBounce = (fromHref, toHref, ts) => {
      const back = window.location.href;
      const delta = Date.now() - ts;
      if (back === fromHref && delta <= 500) {
        console.warn("[NAV_TRACE] BOUNCE detected", { awayTo: toHref, backTo: back, deltaMs: delta });
      }
    };

    const pollHref = (label) => {
      const start = Date.now();
      const startHref = window.location.href;
      const handler = setInterval(() => {
        const current = window.location.href;
        if (current !== lastHrefRef.current) {
          console.log("[NAV_TRACE] HREF_POLL", { label, from: lastHrefRef.current, to: current, ts: Date.now() });
          lastHrefRef.current = current;
          detectBounce(startHref, current, start);
        }
        if (Date.now() - start > 5000) {
          clearInterval(handler);
          if (pollTimerRef.current === handler) pollTimerRef.current = null;
        }
      }, 100);
      pollTimerRef.current = handler;
    };

    const clickWatcher = (event) => {
      try {
        const target = event.target;
        const diag = target?.closest?.("[data-clickdiag]");
        const diagBound = target?.closest?.("[data-clickdiag-bound]");
        const href = target?.closest?.("a[href]")?.getAttribute?.("href");
        const label = diag?.dataset?.clickdiag || diagBound?.dataset?.clickdiagBound || href || event.type;
        if (
          diag?.dataset?.clickdiag === "nav-saved" ||
          diag?.dataset?.clickdiag === "nav-settings" ||
          diagBound?.dataset?.clickdiagBound === "tile"
        ) {
          pollHref(label);
        }
      } catch (err) {
        console.warn("[NAV_TRACE] clickWatcher error", err);
      }
    };

    document.addEventListener("click", clickWatcher, { capture: true, passive: true });
    document.addEventListener("pointerdown", clickWatcher, { capture: true, passive: true });

    return () => {
      document.removeEventListener("click", clickWatcher, { capture: true, passive: true });
      document.removeEventListener("pointerdown", clickWatcher, { capture: true, passive: true });
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isActiveInstance() || typeof document === "undefined") return undefined;
    const body = document.body;
    if (!body) return undefined;
    const obs = new MutationObserver((mutations) => {
      const ts = Date.now();
      mutations.forEach((m) => {
        if (m.type === "attributes" && (m.attributeName === "class" || m.attributeName === "style")) {
          console.log("[NAV_TRACE] body mutation", {
            attr: m.attributeName,
            value: body.getAttribute(m.attributeName),
            ts,
          });
        }
      });
    });
    obs.observe(body, { attributes: true, attributeFilter: ["class", "style"] });
    bodyObserverRef.current = obs;
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!isActiveInstance() || typeof window === "undefined") return undefined;
    const interval = setInterval(() => {
      const href = window.location.href;
      if (href !== lastChangeRef.current.href) {
        const prev = lastChangeRef.current;
        lastChangeRef.current = { href, ts: Date.now() };
        console.log("[NAV_TRACE] href changed (poll)", { from: prev.href, to: href, ts: Date.now() });
      }
    }, 400);
    return () => clearInterval(interval);
  }, []);

  useEffect(
    () => () => {
      if (mountedRef.current) {
        delete window.__NAV_TRACE_ACTIVE__;
      }
    },
    []
  );

  return null;
}
