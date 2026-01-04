"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const isDiag = () => process.env.NEXT_PUBLIC_CLICK_DIAG === "1";

export default function SafeNavFallback() {
  const router = useRouter();
  const guardRef = useRef({ ts: 0, path: null });
  const navFlagRef = useRef({ didNavigate: false });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const shouldIgnore = (event, anchor, href) => {
      if (!anchor) return true;
      if (!event.isTrusted) return true;
      if (!anchor.hasAttribute("data-safe-nav")) return true;
      if (event.button !== 0) return true;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return true;
      if (!href || href.startsWith("http://") || href.startsWith("https://")) return true;
      if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#") || href.startsWith("javascript:")) {
        return true;
      }
      if (anchor.target && anchor.target !== "_self") return true;
      if (anchor.hasAttribute("download")) return true;
      if (!href.startsWith("/")) return true;
      if (anchor.closest?.("[data-no-safe-nav='1']")) return true;
      return false;
    };

    const handleClick = (event) => {
      try {
        const anchor = event.target?.closest?.("a[href]");
        const href = anchor?.getAttribute?.("href") || "";
        if (shouldIgnore(event, anchor, href)) return;

        const path = href;
        const now = Date.now();
        if (guardRef.current.path === path && now - guardRef.current.ts < 1200) {
          return;
        }
        if (window.location.pathname === path) return;
        guardRef.current = { path, ts: now };

        navFlagRef.current.didNavigate = false;
        const markNav = () => {
          navFlagRef.current.didNavigate = true;
        };

        const popHandler = () => markNav();
        const hashHandler = () => markNav();
        window.addEventListener("popstate", popHandler);
        window.addEventListener("hashchange", hashHandler);

        const unpatches = [];
        const patchHistory = (method) => {
          const desc = Object.getOwnPropertyDescriptor(history, method);
          if (desc && desc.writable === false && !desc.set) return null;
          const original = history[method];
          if (typeof original !== "function") return null;
          history[method] = function patched(...args) {
            markNav();
            return original.apply(this, args);
          };
          return () => {
            try {
              history[method] = original;
            } catch {
              /* ignore */
            }
          };
        };
        const up1 = patchHistory("pushState");
        const up2 = patchHistory("replaceState");
        if (up1) unpatches.push(up1);
        if (up2) unpatches.push(up2);

        const cleanup = () => {
          window.removeEventListener("popstate", popHandler);
          window.removeEventListener("hashchange", hashHandler);
          unpatches.forEach((fn) => {
            try {
              fn();
            } catch {
              /* ignore */
            }
          });
        };

        setTimeout(() => {
          if (!navFlagRef.current.didNavigate) {
            if (isDiag()) {
              // eslint-disable-next-line no-console
              console.log("[SAFE_NAV] fallback push", { path, reason: "timeout" });
            }
            router.push(path);
          }
          cleanup();
        }, 250);
      } catch (err) {
        if (isDiag()) {
          // eslint-disable-next-line no-console
          console.warn("[SAFE_NAV] error", err);
        }
      }
    };

    document.addEventListener("click", handleClick, { capture: true, passive: true });
    return () => {
      document.removeEventListener("click", handleClick, { capture: true, passive: true });
    };
  }, [router]);

  return null;
}
