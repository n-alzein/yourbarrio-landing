"use client";

/*
 * DEBUG_CLICK_DIAG
 *
 * How to enable:
 *   - Set NEXT_PUBLIC_CLICK_DIAG=1
 *   - Run production locally: rm -rf .next && npm run build && npm run start
 *   - Repro: login -> go to /customer/home -> open navbar dropdown -> click Saved/Settings -> click a home tile
 *   - Collect the grouped console logs labeled [CLICK_DIAG] including overlay suspects + error buffer.
 *
 * What to check in console after reproducing:
 *   window.__CLICK_DIAG_MOUNTED__     // proves diagnostics mounted with timestamp/href
 *   window.__CLICK_DIAG_HEARTBEAT__   // last heartbeat timestamp (updates every second)
 *   window.__CLICK_DIAG_FRAMES__      // requestAnimationFrame counter (increments if frame loop alive)
 *   window.__CLICK_DIAG_LAST_EVENT__  // last captured global input event summary
 *   window.__CLICK_DIAG_NAV_TOP__     // current elementFromPoint over navbar zone
 */

import { useEffect, useRef, useState } from "react";

const CLICK_DIAG_ENABLED = process.env.NEXT_PUBLIC_CLICK_DIAG === "1";
const MAX_BUFFER = 50;

const STYLE_PROPS = [
  "pointerEvents",
  "position",
  "zIndex",
  "opacity",
  "display",
  "visibility",
  "transform",
  "filter",
];

function describeEl(el) {
  if (!el || !el.tagName) return "null";
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const classes = (el.className || "")
    .toString()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((cls) => `.${cls}`)
    .join("");
  const data = el.dataset?.clickdiag ? `[data-clickdiag=${el.dataset.clickdiag}]` : "";
  const bound = el.dataset?.clickdiagBound
    ? `[bound=${el.dataset.clickdiagBound}]`
    : "";
  return `${tag}${id}${classes}${data}${bound}`;
}

function describeAction(el) {
  if (!el) return null;
  const a = el.closest?.("a");
  const btn = el.closest?.("button");
  const roleBtn = el.closest?.('[role="button"]');
  const action = a || btn || roleBtn || null;
  if (!action) return null;
  const cs = window.getComputedStyle(action);
  return {
    tag: action.tagName,
    id: action.id || null,
    class:
      (action.className && action.className.baseVal)
        ? action.className.baseVal
        : action.className,
    href: action.getAttribute?.("href") || null,
    type: action.getAttribute?.("type") || null,
    disabled: action.disabled ?? null,
    ariaDisabled: action.getAttribute?.("aria-disabled") || null,
    pointerEvents: cs.pointerEvents,
    zIndex: cs.zIndex,
    position: cs.position,
  };
}

function safePatch(label, target, key, wrapperFactory, statusMap) {
  try {
    let owner = target;
    let descriptor = Object.getOwnPropertyDescriptor(owner, key);
    while (!descriptor && owner && Object.getPrototypeOf(owner)) {
      owner = Object.getPrototypeOf(owner);
      descriptor = Object.getOwnPropertyDescriptor(owner, key);
    }
    if (!descriptor) {
      console.warn("[CLICK_DIAG] patch skipped", { label, key, reason: "missing descriptor" });
      if (statusMap) statusMap[label] = "skipped";
      return null;
    }
    const writable = descriptor.writable !== false || typeof descriptor.set === "function";
    const configurable = descriptor.configurable !== false;
    if (!writable || !configurable) {
      console.warn("[CLICK_DIAG] patch skipped", {
        label,
        key,
        reason: "readonly or non-configurable",
        descriptor,
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
        // ignore restore failures
      }
    };
  } catch (err) {
    console.warn("[CLICK_DIAG] patch skipped", { label, key, reason: `${err}` });
    if (statusMap) statusMap[label] = "skipped";
    return null;
  }
}

function textSnippet(el) {
  if (!el || typeof el.textContent !== "string") return "";
  const trimmed = el.textContent.trim().replace(/\s+/g, " ");
  return trimmed.slice(0, 60);
}

function grabStyles(el) {
  if (!el) return {};
  const computed = window.getComputedStyle(el);
  const result = {};
  STYLE_PROPS.forEach((prop) => {
    result[prop] = computed.getPropertyValue(prop) || computed[prop];
  });
  return result;
}

function pushBuffer(ref, entry) {
  const list = ref.current || [];
  list.push(entry);
  while (list.length > MAX_BUFFER) {
    list.shift();
  }
  ref.current = list;
}

function collectOverlaySuspects(x, y) {
  const selectors =
    "[style*='position: fixed'], .fixed, [style*='position: absolute'], .absolute";
  const candidates = Array.from(document.querySelectorAll(selectors)).slice(0, 220);
  return candidates
    .map((el) => {
      const rect = el.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return null;
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
      const styles = grabStyles(el);
      return {
        el,
        rect,
        styles,
        label: describeEl(el),
        zIndex: Number.parseFloat(styles.zIndex) || 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.zIndex - a.zIndex);
}

function walkUpStyles(el, depth = 6) {
  const chain = [];
  let current = el;
  while (current && chain.length < depth) {
    chain.push({ el: current, styles: grabStyles(current) });
    current = current.parentElement;
  }
  return chain;
}

export default function ClickDiagnostics() {
  // Proof-of-mount logs
  console.log("[CLICK_DIAG] mounted", { href: typeof location !== "undefined" ? location.href : "n/a", ts: Date.now() });
  console.log("[CLICK_DIAG] env", { NEXT_PUBLIC_CLICK_DIAG: process.env.NEXT_PUBLIC_CLICK_DIAG });
  if (typeof window !== "undefined") {
    window.__CLICK_DIAG_MOUNTED__ = {
      ts: Date.now(),
      href: typeof location !== "undefined" ? location.href : "n/a",
    };
  }

  const [lastClick, setLastClick] = useState(null);
  const [lastTop, setLastTop] = useState(null);
  const [navbarWarning, setNavbarWarning] = useState(null);
  const errorsRef = useRef([]);
  const pageshowPersistedRef = useRef(false);
  const lastPersistEventRef = useRef(null);

  useEffect(() => {
    if (!CLICK_DIAG_ENABLED) return undefined;

    console.log("[CLICK_DIAG] mounted effect", { href: location.href, ts: Date.now() });
    console.log("[CLICK_DIAG] verify: window.__CLICK_DIAG_MOUNTED__", window.__CLICK_DIAG_MOUNTED__);
    console.log("[CLICK_DIAG] verify: UA", navigator.userAgent);

    if (typeof window !== "undefined") {
      window.__CLICK_DIAG_MOUNTED__ = {
        ts: Date.now(),
        href: location.href,
      };
    }

    const logRuntimeError = (type, event) => {
      const payload = {
        type,
        message: event?.message || event?.reason || "unknown",
        stack: event?.error?.stack || event?.reason?.stack || null,
        href: location.href,
        time: Date.now(),
      };
      console.error("[CLICK_DIAG] RUNTIME_ERROR", payload);
    };

    const onError = (event) => {
      try {
        const payload = {
          type: "error",
          message: event?.message,
          filename: event?.filename,
          lineno: event?.lineno,
          colno: event?.colno,
          time: Date.now(),
          error: event?.error ? `${event.error}` : null,
        };
        pushBuffer(errorsRef, payload);
        console.warn("[CLICK_DIAG] runtime error captured", payload);
        logRuntimeError("error", event);
      } catch {
        /* ignore */
      }
    };

    const onRejection = (event) => {
      try {
        const payload = {
          type: "unhandledrejection",
          message: event?.reason ? `${event.reason}` : "unhandled rejection",
          time: Date.now(),
        };
        pushBuffer(errorsRef, payload);
        console.warn("[CLICK_DIAG] unhandled rejection captured", payload);
        logRuntimeError("unhandledrejection", event);
      } catch {
        /* ignore */
      }
    };

    const onPageShow = (event) => {
      pageshowPersistedRef.current = !!event?.persisted;
      lastPersistEventRef.current = event?.timeStamp || Date.now();
      console.info("[CLICK_DIAG] pageshow", {
        persisted: event?.persisted,
        time: new Date().toISOString(),
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  useEffect(() => {
    if (!CLICK_DIAG_ENABLED) return undefined;

    let tickCount = 0;
    let lastHref = typeof location !== "undefined" ? location.href : "";
    const hb = setInterval(() => {
      tickCount += 1;
      const now = Date.now();
      window.__CLICK_DIAG_HEARTBEAT__ = now;
      if (tickCount % 5 === 0) {
        console.log("[CLICK_DIAG] heartbeat", now, location.href);
      }
      const currentHref = location.href;
      if (currentHref !== lastHref) {
        console.log("[CLICK_DIAG] HREF_CHANGED", { from: lastHref, to: currentHref, ts: now });
        lastHref = currentHref;
      }
    }, 1000);

    let frames = 0;
    window.__CLICK_DIAG_FRAMES__ = frames;
    let raf;
    const tick = () => {
      frames += 1;
      window.__CLICK_DIAG_FRAMES__ = frames;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const frameLog = setInterval(() => {
      console.log("[CLICK_DIAG] raf_frames", frames);
    }, 2000);

    return () => {
      clearInterval(hb);
      clearInterval(frameLog);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (!CLICK_DIAG_ENABLED) return undefined;

    const patchStatus = {
      pushState: "skipped",
      replaceState: "skipped",
      locationAssign: "skipped",
      locationReplace: "skipped",
    };

    const logNavIntent = (label, args) => {
      console.groupCollapsed("[CLICK_DIAG] NAV_INTENT", label);
      console.log({
        ts: Date.now(),
        href: location.href,
        args,
        stack: new Error().stack,
      });
      console.groupEnd();
    };

    const unpatches = [];

    const pushUnpatch = safePatch(
      "pushState",
      history,
      "pushState",
      (original) =>
        function pushStatePatched(...args) {
          logNavIntent("pushState", args);
          return original?.apply?.(this, args);
        },
      patchStatus
    );
    if (pushUnpatch) unpatches.push(pushUnpatch);

    const replaceUnpatch = safePatch(
      "replaceState",
      history,
      "replaceState",
      (original) =>
        function replaceStatePatched(...args) {
          logNavIntent("replaceState", args);
          return original?.apply?.(this, args);
        },
      patchStatus
    );
    if (replaceUnpatch) unpatches.push(replaceUnpatch);

    console.log("[CLICK_DIAG] patch status", patchStatus);

    const onPopstate = (event) => logNavIntent("popstate", [event.state]);
    const onHashchange = (event) =>
      logNavIntent("hashchange", [{ oldURL: event.oldURL, newURL: event.newURL }]);
    const onBeforeUnload = (event) => logNavIntent("beforeunload", [event.returnValue]);
    const onPageHide = (event) => logNavIntent("pagehide", [event.persisted]);
    const onVisibility = () =>
      logNavIntent("visibilitychange", [document.visibilityState]);

    window.addEventListener("popstate", onPopstate);
    window.addEventListener("hashchange", onHashchange);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      unpatches.forEach((fn) => {
        try {
          fn();
        } catch {
          /* ignore */
        }
      });
      window.removeEventListener("popstate", onPopstate);
      window.removeEventListener("hashchange", onHashchange);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!CLICK_DIAG_ENABLED) return undefined;

    const globalHandler = (event) => {
      try {
        const x = event.clientX ?? (event.touches?.[0]?.clientX ?? null);
        const y = event.clientY ?? (event.touches?.[0]?.clientY ?? null);
        const record = {
          type: event.type,
          ts: Date.now(),
          targetTag: event.target?.tagName || null,
          x,
          y,
        };
        window.__CLICK_DIAG_LAST_EVENT__ = record;
        console.log("[CLICK_DIAG] EVENT", event.type, x, y, event.target?.tagName, event.target?.className);
      } catch (err) {
        console.warn("[CLICK_DIAG] EVENT handler error", err);
      }
    };

    const targets = [
      { node: window, opts: true },
      { node: document, opts: true },
      { node: document.documentElement, opts: true },
      { node: document.body, opts: true },
    ].filter((t) => t.node);

    const events = ["pointerdown", "mousedown", "click", "touchstart", "keydown"];
    targets.forEach(({ node, opts }) => {
      events.forEach((type) => node.addEventListener(type, globalHandler, { capture: opts === true, passive: true }));
    });

    return () => {
      targets.forEach(({ node, opts }) => {
        events.forEach((type) =>
          node.removeEventListener(type, globalHandler, { capture: opts === true, passive: true })
        );
      });
    };
  }, []);

  useEffect(() => {
    if (!CLICK_DIAG_ENABLED) return undefined;

    let lastX = null;
    let lastY = null;
    let lastTopDescriptor = null;
    let lastNavDescriptor = null;
    let lastSample = 0;

    const describeSimple = (el) => {
      if (!el || !el.tagName) return "null";
      const tag = el.tagName.toLowerCase();
      const cls = (el.className || "").toString().split(/\s+/).filter(Boolean).slice(0, 2).join(".");
      const id = el.id ? `#${el.id}` : "";
      return `${tag}${id}${cls ? `.${cls}` : ""}`;
    };

    const sample = () => {
      if (lastX == null || lastY == null) return;
      const top = document.elementFromPoint(lastX, lastY);
      const desc = describeSimple(top);
      if (desc !== lastTopDescriptor) {
        lastTopDescriptor = desc;
        window.__CLICK_DIAG_HOVER_TOP__ = {
          tag: top?.tagName || null,
          class: top?.className || null,
          id: top?.id || null,
          ts: Date.now(),
        };
        console.log("[CLICK_DIAG] hover top", desc);
      }

      const navX = Math.max(0, (window.innerWidth || 0) - 80);
      const navY = 80;
      const navTop = document.elementFromPoint(navX, navY);
      const navDesc = describeSimple(navTop);
      if (navDesc !== lastNavDescriptor) {
        lastNavDescriptor = navDesc;
        window.__CLICK_DIAG_NAV_TOP__ = navDesc;
        console.log("[CLICK_DIAG] nav top", navDesc);
      }
    };

    const onMove = (event) => {
      lastX = event.clientX;
      lastY = event.clientY;
      const now = Date.now();
      if (now - lastSample >= 250) {
        lastSample = now;
        sample();
      }
    };

    window.addEventListener("mousemove", onMove, { capture: true, passive: true });

    return () => {
      window.removeEventListener("mousemove", onMove, { capture: true, passive: true });
    };
  }, []);

  useEffect(() => {
    if (!CLICK_DIAG_ENABLED) return undefined;

    const logPointerEvent = (type, event) => {
      if (!event || typeof document === "undefined") return;
      const clientX = event.clientX ?? 0;
      const clientY = event.clientY ?? 0;
      const top = document.elementFromPoint(clientX, clientY);
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];

      const inDropdown = path.some((node) => node?.dataset?.clickdiag === "dropdown");
      const inNavbar = path.some((node) => node?.dataset?.clickdiag === "navbar");
      const inTile = path.some((node) => node?.dataset?.clickdiag === "tile");
      const label = [
        type.toUpperCase(),
        inDropdown ? "NAV_DROPDOWN_CLICK" : null,
        inTile ? "HOME_TILE_CLICK" : null,
      ]
        .filter(Boolean)
        .join(" · ");

      const topChain = [];
      let cursor = top;
      while (cursor && topChain.length < 3) {
        topChain.push(cursor);
        cursor = cursor.parentElement;
      }

      const overlaySuspects = clientY < 120 ? collectOverlaySuspects(clientX, clientY) : [];
      const navChain =
        clientY < 120 ? walkUpStyles(document.elementFromPoint(clientX, clientY)) : [];

      const recentErrors = (errorsRef.current || []).slice(-10);
      const payload = {
        type,
        point: { x: clientX, y: clientY },
        target: describeEl(event.target),
        currentTarget: describeEl(event.currentTarget),
        top: describeEl(top),
        topChain: topChain.map((el) => ({
          el: describeEl(el),
          styles: grabStyles(el),
        })),
        path: path.slice(0, 10).map(describeEl),
        defaultPrevented: event.defaultPrevented,
        cancelBubble: event.cancelBubble,
        eventPhase: event.eventPhase,
        time: new Date().toISOString(),
        inDropdown,
        inNavbar,
        inTile,
        overlaySuspects: overlaySuspects.slice(0, 5).map((s) => ({
          label: s.label,
          styles: s.styles,
          rect: {
            x: s.rect.x,
            y: s.rect.y,
            width: s.rect.width,
            height: s.rect.height,
            top: s.rect.top,
            left: s.rect.left,
            right: s.rect.right,
            bottom: s.rect.bottom,
          },
        })),
        navChain: navChain.map((entry) => ({
          el: describeEl(entry.el),
          styles: entry.styles,
        })),
        pageshowPersisted: pageshowPersistedRef.current,
        lastPersistEvent: lastPersistEventRef.current,
        errors: recentErrors,
        targetSnippet: textSnippet(event.target),
        actionTarget: describeAction(event.target),
        actionTop: describeAction(top),
        pathTags: path.slice(0, 7).map((n) => n?.tagName || n?.nodeName || "null"),
      };

      console.groupCollapsed(`[CLICK_DIAG] ACTION_TRACE ${label || type.toUpperCase()} @ ${clientX},${clientY}`);
      console.log(payload);
      console.groupEnd();

      queueMicrotask(() => {
        console.log("[CLICK_DIAG] POST_CLICK_STATE", {
          href: location.href,
          activeEl: document.activeElement?.tagName,
        });
      });
      requestAnimationFrame(() => {
        console.log("[CLICK_DIAG] HREF_AFTER_CLICK", {
          label,
          href: location.href,
          phase: "raf",
        });
      });
      setTimeout(() => {
        console.log("[CLICK_DIAG] HREF_AFTER_CLICK", {
          label,
          href: location.href,
          phase: "t+50",
        });
      }, 50);
      setTimeout(() => {
        console.log("[CLICK_DIAG] HREF_AFTER_CLICK", {
          label,
          href: location.href,
          phase: "t+250",
        });
      }, 250);

      const overlayWarning =
        clientY < 120 && overlaySuspects.length
          ? `Navbar region covered by ${overlaySuspects[0].label} (z-index ${overlaySuspects[0].styles.zIndex}, pointer-events ${overlaySuspects[0].styles.pointerEvents})`
          : null;

      setNavbarWarning(overlayWarning);
      setLastClick({
        target: describeEl(event.target),
        snippet: textSnippet(event.target),
      });
      setLastTop(describeEl(top));
    };

    const handlePointerDown = (event) => {
      try {
        logPointerEvent("pointerdown", event);
      } catch (err) {
        console.warn("[CLICK_DIAG] pointerdown log error", err);
      }
    };
    const handlePointerUp = (event) => {
      try {
        logPointerEvent("pointerup", event);
      } catch (err) {
        console.warn("[CLICK_DIAG] pointerup log error", err);
      }
    };
    const handleClick = (event) => {
      try {
        logPointerEvent("click", event);
      } catch (err) {
        console.warn("[CLICK_DIAG] click log error", err);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown, { capture: true, passive: true });
    window.addEventListener("pointerup", handlePointerUp, { capture: true, passive: true });
    window.addEventListener("click", handleClick, { capture: true, passive: true });

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, { capture: true, passive: true });
      window.removeEventListener("pointerup", handlePointerUp, { capture: true, passive: true });
      window.removeEventListener("click", handleClick, { capture: true, passive: true });
    };
  }, []);

  if (!CLICK_DIAG_ENABLED) return null;

  return (
    <div
      // DEBUG_CLICK_DIAG overlay
      style={{
        position: "fixed",
        bottom: 12,
        right: 12,
        zIndex: 99999,
        background: "rgba(10, 10, 10, 0.78)",
        color: "white",
        padding: "10px 12px",
        borderRadius: "12px",
        fontSize: "12px",
        maxWidth: "320px",
        lineHeight: 1.4,
        pointerEvents: "none",
        boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
        border: "1px solid rgba(255,255,255,0.15)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          pointerEvents: "auto",
        }}
      >
        <button
          type="button"
          onClick={() => {
            console.log("[CLICK_DIAG] PING CLICK", Date.now());
          }}
          style={{
            fontSize: "10px",
            padding: "4px 6px",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.1)",
            color: "white",
            cursor: "pointer",
            pointerEvents: "auto",
          }}
        >
          PING
        </button>
      </div>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Click Diagnostics</div>
      <div>
        Last target: <span style={{ color: "#c7d2fe" }}>{lastClick?.target || "—"}</span>
      </div>
      <div style={{ color: "#9ca3af" }}>
        Text: {lastClick?.snippet ? `"${lastClick.snippet}"` : "—"}
      </div>
      <div style={{ marginTop: 4 }}>
        elementFromPoint: <span style={{ color: "#a5f3fc" }}>{lastTop || "—"}</span>
      </div>
      {navbarWarning ? (
        <div
          style={{
            marginTop: 8,
            padding: "6px 8px",
            background: "rgba(251, 191, 36, 0.15)",
            color: "#fcd34d",
            borderRadius: "8px",
            fontWeight: 600,
          }}
        >
          {navbarWarning}
        </div>
      ) : null}
    </div>
  );
}
