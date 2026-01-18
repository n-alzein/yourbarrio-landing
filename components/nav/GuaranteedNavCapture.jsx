"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import useTapGuard from "@/components/nav/useTapGuard";

export default function GuaranteedNavCapture() {
  const pathname = usePathname();
  const router = useRouter();
  const lastPushRef = useRef({ href: null, ts: 0 });
  const clickDiagEnabled = process.env.NEXT_PUBLIC_CLICK_DIAG === "1";
  const didNavigateRef = useRef(false);
  const pendingTimerRef = useRef(null);
  const prevPathRef = useRef(pathname);

  useTapGuard({
    enabled: pathname?.startsWith("/customer/home"),
    movePx: 10,
    scrollWindowMs: 320,
    navSelector: 'a[href], [data-safe-nav]',
  });

  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      didNavigateRef.current = true;
      prevPathRef.current = pathname;
    }
  }, [pathname]);

  useEffect(() => {
    if (!pathname?.startsWith("/customer/home")) return undefined;

    const findAnchorAtPoint = (x, y) => {
      const stack = typeof document.elementsFromPoint === "function" ? document.elementsFromPoint(x, y) : [];
      const toDescribe = stack.slice(0, 6).map((el) => ({
        tag: el?.tagName?.toLowerCase?.() || el?.nodeName?.toLowerCase?.() || "unknown",
        className: (el?.className || "").toString(),
      }));

      for (const el of stack) {
        if (!el) continue;
        if (el.matches?.('[data-nav-guard="1"]')) {
          return { anchor: null, stack: toDescribe };
        }
        if (el.closest?.('[data-nav-guard="1"]')) {
          return { anchor: null, stack: toDescribe };
        }
        if (el.matches?.('[data-sticky-nav-block="1"]')) {
          return { anchor: null, stack: toDescribe };
        }
        if (el.closest?.('[data-sticky-nav-block="1"]')) {
          return { anchor: null, stack: toDescribe };
        }
      }

      for (const el of stack) {
        if (!el) continue;
        if (el.matches?.('a[data-safe-nav="1"][href]')) {
          return { anchor: el, stack: toDescribe };
        }
        if (el.closest) {
          const found = el.closest('a[data-safe-nav="1"][href]');
          if (found) {
            return { anchor: found, stack: toDescribe };
          }
        }
      }
      return { anchor: null, stack: toDescribe };
    };

    const handle = (event) => {
      try {
        if (!event?.isTrusted) return;
        const button = typeof event.button === "number" ? event.button : 0;
        if (button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          if (clickDiagEnabled) {
            console.log("[GUARDED_NAV] ignore modifier", {
              type: event.type,
              metaKey: event.metaKey,
              ctrlKey: event.ctrlKey,
              shiftKey: event.shiftKey,
              altKey: event.altKey,
            });
          }
          return;
        }

        const isTouch = event.type === "touchend";
        const coordSource = isTouch
          ? event.changedTouches?.[0]
          : event;
        const x = coordSource?.clientX;
        const y = coordSource?.clientY;
        if (typeof x !== "number" || typeof y !== "number") return;

        const { anchor, stack } = findAnchorAtPoint(x, y);
        if (clickDiagEnabled) {
          console.log("[GUARDED_NAV] hit-test", {
            type: event.type,
            x,
            y,
            foundHref: anchor?.getAttribute?.("href") || null,
            stack,
          });
        }
        if (!anchor) return;

        const hrefRaw = anchor.getAttribute("href") || "";
        const href = hrefRaw.trim();
        if (!href) return;
        const lower = href.toLowerCase();
        if (
          lower.startsWith("http://") ||
          lower.startsWith("https://") ||
          lower.startsWith("//") ||
          lower.startsWith("mailto:") ||
          lower.startsWith("tel:") ||
          lower.startsWith("javascript:") ||
          href.startsWith("#")
        ) {
          return;
        }
        if (anchor.target === "_blank" || anchor.hasAttribute("download")) {
          return;
        }

        let url;
        try {
          url = new URL(href, window.location.href);
        } catch {
          url = null;
        }
        if (!url) return;
        if (url.origin !== window.location.origin) {
          return;
        }

        const now = Date.now();
        if (
          lastPushRef.current.href === url.href &&
          now - (lastPushRef.current.ts || 0) < 1200
        ) {
          return;
        }
        lastPushRef.current = { href: url.href, ts: now };
        didNavigateRef.current = false;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();

        const targetPath = `${url.pathname}${url.search}${url.hash}`;

        if (clickDiagEnabled) {
          console.log("[GUARDED_NAV] force push", {
            href: targetPath,
            type: event.type,
            defaultPrevented: event.defaultPrevented,
            targetTag: event.target?.tagName,
          });
        }

        router.push(targetPath);
        if (pendingTimerRef.current) {
          clearTimeout(pendingTimerRef.current);
        }
        const onNavEvent = () => {
          didNavigateRef.current = true;
        };
        window.addEventListener("popstate", onNavEvent, { passive: true });
        window.addEventListener("hashchange", onNavEvent, { passive: true });
        pendingTimerRef.current = setTimeout(() => {
          window.removeEventListener("popstate", onNavEvent, { passive: true });
          window.removeEventListener("hashchange", onNavEvent, { passive: true });
          if (didNavigateRef.current) return;
          if (clickDiagEnabled) {
            console.warn("[GUARDED_NAV_ESCALATE]", { href: targetPath, stack: new Error().stack });
          }
          window.location.assign(targetPath);
        }, 350);
        queueMicrotask(() => {
          anchor.blur?.();
        });
      } catch {
        /* ignore */
      }
    };

    document.addEventListener("pointerup", handle, { capture: true, passive: false });
    document.addEventListener("touchend", handle, { capture: true, passive: false });
    document.addEventListener("click", handle, { capture: true, passive: false });
    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
      }
      document.removeEventListener("pointerup", handle, { capture: true, passive: false });
      document.removeEventListener("touchend", handle, { capture: true, passive: false });
      document.removeEventListener("click", handle, { capture: true, passive: false });
    };
  }, [pathname, router, clickDiagEnabled]);

  return null;
}
