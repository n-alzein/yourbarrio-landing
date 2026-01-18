"use client";

import { useEffect, useRef } from "react";

const DEFAULT_NAV_SELECTOR = 'a[href], [data-safe-nav]';
const INTERACTIVE_SELECTOR = 'input, textarea, select, button, [contenteditable="true"]';

const isDiagEnabled = () => process.env.NEXT_PUBLIC_CLICK_DIAG === "1";

const describeElement = (el) => {
  if (!el) return null;
  const tag = el.tagName?.toLowerCase?.() || "unknown";
  const id = el.id ? `#${el.id}` : "";
  const className = typeof el.className === "string" && el.className.trim()
    ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}`
    : "";
  return `${tag}${id}${className}`;
};

const findNavTarget = (event, navSelector) => {
  const path = typeof event.composedPath === "function" ? event.composedPath() : [];
  for (const node of path) {
    if (!node || node.nodeType !== 1) continue;
    const el = node;
    if (el.matches?.(navSelector)) return el;
    if (el.closest) {
      const found = el.closest(navSelector);
      if (found) return found;
    }
  }
  const fallback = event.target?.closest?.(navSelector);
  return fallback || null;
};

const isInteractivePath = (event) => {
  const path = typeof event.composedPath === "function" ? event.composedPath() : [];
  for (const node of path) {
    if (!node || node.nodeType !== 1) continue;
    if (node.matches?.(INTERACTIVE_SELECTOR)) return true;
  }
  return false;
};

export default function useTapGuard({
  enabled = true,
  movePx = 10,
  scrollWindowMs = 320,
  touchWindowMs = 1500,
  navSelector = DEFAULT_NAV_SELECTOR,
} = {}) {
  const gestureRef = useRef({
    startX: 0,
    startY: 0,
    startTime: 0,
    moved: false,
    active: false,
    lastTouchTs: 0,
    recentlyScrolledUntil: 0,
  });

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return undefined;

    const log = (label, payload) => {
      if (!isDiagEnabled()) return;
      console.log(`[TAP_GUARD] ${label}`, payload);
    };

    const markScrollWindow = (now) => {
      gestureRef.current.recentlyScrolledUntil = now + scrollWindowMs;
      log("scroll", {
        recentlyScrolledUntil: gestureRef.current.recentlyScrolledUntil,
      });
    };

    const handleTouchStart = (event) => {
      const touch = event.touches?.[0];
      if (!touch) return;
      const now = Date.now();
      gestureRef.current.startX = touch.clientX;
      gestureRef.current.startY = touch.clientY;
      gestureRef.current.startTime = now;
      gestureRef.current.moved = false;
      gestureRef.current.active = true;
      gestureRef.current.lastTouchTs = now;
      log("touchstart", {
        x: touch.clientX,
        y: touch.clientY,
        ts: now,
      });
    };

    const handleTouchMove = (event) => {
      if (!gestureRef.current.active) return;
      const touch = event.touches?.[0];
      if (!touch) return;
      const dx = touch.clientX - gestureRef.current.startX;
      const dy = touch.clientY - gestureRef.current.startY;
      const dist = Math.hypot(dx, dy);
      if (dist >= movePx) {
        gestureRef.current.moved = true;
      }
      const now = Date.now();
      gestureRef.current.lastTouchTs = now;
      markScrollWindow(now);
      log("touchmove", {
        dx,
        dy,
        dist,
        moved: gestureRef.current.moved,
      });
    };

    const handleTouchEnd = () => {
      const now = Date.now();
      gestureRef.current.lastTouchTs = now;
      gestureRef.current.active = false;
      log("touchend", { moved: gestureRef.current.moved, ts: now });
    };

    const handleScroll = () => {
      const now = Date.now();
      if (now - gestureRef.current.lastTouchTs > touchWindowMs) return;
      markScrollWindow(now);
    };

    const shouldSuppressClick = (event) => {
      const now = Date.now();
      if (now - gestureRef.current.lastTouchTs > touchWindowMs) return false;
      const isMoved = gestureRef.current.moved;
      const isRecentlyScrolled = now < gestureRef.current.recentlyScrolledUntil;
      if (!isMoved && !isRecentlyScrolled) return false;
      if (!event.isTrusted) return false;
      const button = typeof event.button === "number" ? event.button : 0;
      if (button !== 0) return false;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
      if (isInteractivePath(event)) return false;

      const navTarget = findNavTarget(event, navSelector);
      if (!navTarget) return false;
      if (navTarget.closest?.("[data-no-safe-nav='1']")) return false;

      const anchor = navTarget.matches?.("a[href]")
        ? navTarget
        : navTarget.closest?.("a[href]");
      if (!anchor) return false;

      const hrefRaw = anchor.getAttribute("href") || "";
      const href = hrefRaw.trim();
      if (!href) return false;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return false;
      const lower = href.toLowerCase();
      if (
        lower.startsWith("mailto:") ||
        lower.startsWith("tel:") ||
        lower.startsWith("javascript:")
      ) {
        return false;
      }
      if (lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("//")) {
        try {
          const url = new URL(href, window.location.href);
          if (url.origin !== window.location.origin) return false;
        } catch {
          return false;
        }
      }

      const reason = isMoved ? "moved" : "recentlyScrolled";
      log("suppress", {
        reason,
        href,
        target: describeElement(anchor),
      });
      return true;
    };

    const handleClick = (event) => {
      if (!shouldSuppressClick(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    };

    document.addEventListener("touchstart", handleTouchStart, { capture: true, passive: true });
    document.addEventListener("touchmove", handleTouchMove, { capture: true, passive: true });
    document.addEventListener("touchend", handleTouchEnd, { capture: true, passive: true });
    document.addEventListener("click", handleClick, { capture: true, passive: false });
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart, { capture: true, passive: true });
      document.removeEventListener("touchmove", handleTouchMove, { capture: true, passive: true });
      document.removeEventListener("touchend", handleTouchEnd, { capture: true, passive: true });
      document.removeEventListener("click", handleClick, { capture: true, passive: false });
      window.removeEventListener("scroll", handleScroll, { passive: true });
    };
  }, [enabled, movePx, navSelector, scrollWindowMs, touchWindowMs]);
}
