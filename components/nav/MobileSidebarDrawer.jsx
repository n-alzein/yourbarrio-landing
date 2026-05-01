"use client";

import { useEffect, useId, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import useBodyScrollLock from "./useBodyScrollLock";

let portalVersion = 0;
const portalListeners = new Set();
let mobileSidebarOpenCount = 0;

function bumpPortalVersion() {
  portalVersion += 1;
  portalListeners.forEach((listener) => listener());
}

function subscribePortal(listener) {
  portalListeners.add(listener);
  return () => portalListeners.delete(listener);
}

function getPortalSnapshot() {
  return portalVersion;
}

function getPortalServerSnapshot() {
  return 0;
}

function subscribeNoop() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

const FOCUSABLE_SELECTORS = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=\"hidden\"])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "object",
  "embed",
  "[contenteditable=\"true\"]",
  "[tabindex]:not([tabindex=\"-1\"])",
].join(",");

export default function MobileSidebarDrawer({
  open,
  onClose,
  title = "Menu",
  subtitle = "YourBarrio",
  children,
  footer = null,
  id,
  showHeader = true,
  shieldActive = false,
  closeButtonVariant = "default",
}) {
  const reactId = useId();
  const panelId = id || `mobile-drawer-${reactId}`;
  const titleId = `${panelId}-title`;
  const panelRef = useRef(null);
  const sidebarRef = useRef(null);
  const closeButtonRef = useRef(null);
  const lastActiveRef = useRef(null);
  const portalNodeRef = useRef(null);
  const wasOpenRef = useRef(open);
  const isClient = useSyncExternalStore(
    subscribeNoop,
    getClientSnapshot,
    getServerSnapshot
  );
  const portalStoreVersion = useSyncExternalStore(
    subscribePortal,
    getPortalSnapshot,
    getPortalServerSnapshot
  );

  useBodyScrollLock(open, { disableBackgroundScroll: false });

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (portalNodeRef.current) return undefined;
    const node = document.createElement("div");
    node.dataset.mobileSidebarDrawer = "1";
    document.body.appendChild(node);
    portalNodeRef.current = node;
    bumpPortalVersion();
    return () => {
      try {
        if (node.isConnected) document.body.removeChild(node);
      } catch {
        /* ignore */
      }
      if (portalNodeRef.current === node) {
        portalNodeRef.current = null;
      }
      bumpPortalVersion();
    };
  }, []);

  useEffect(() => {
    if (open) {
      lastActiveRef.current = document.activeElement;
      requestAnimationFrame(() => {
        if (closeButtonRef.current) {
          closeButtonRef.current.focus();
          return;
        }
        panelRef.current?.focus();
      });
    }
  }, [open]);

  useEffect(() => {
    if (!wasOpenRef.current || open) {
      wasOpenRef.current = open;
      return;
    }
    const lastActive = lastActiveRef.current;
    if (lastActive && typeof lastActive.focus === "function") {
      requestAnimationFrame(() => lastActive.focus());
    }
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (event.button !== 0) return;
      const sidebarEl = sidebarRef.current;
      if (!sidebarEl) return;
      if (!sidebarEl.contains(event.target)) {
        onClose?.();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(panel.querySelectorAll(FOCUSABLE_SELECTORS)).filter(
        (el) => !el.hasAttribute("disabled")
      );
      if (focusables.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !panel.contains(active)) {
          last.focus();
          event.preventDefault();
        }
      } else if (active === last) {
        first.focus();
        event.preventDefault();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useLayoutEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    mobileSidebarOpenCount += 1;
    document.documentElement.dataset.sidebarOpen = "1";
    return () => {
      mobileSidebarOpenCount = Math.max(0, mobileSidebarOpenCount - 1);
      if (mobileSidebarOpenCount === 0) {
        delete document.documentElement.dataset.sidebarOpen;
      }
    };
  }, [open]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const backgroundRoot =
      document.querySelector('[data-testid="customer-page-root"]') ||
      document.querySelector(".app-shell-root") ||
      document.querySelector("main");
    if (!backgroundRoot) return undefined;

    const shouldInertBackground = shieldActive;
    if (shouldInertBackground) {
      backgroundRoot.setAttribute("inert", "");
      backgroundRoot.setAttribute("aria-hidden", "true");
      return () => {
        backgroundRoot.removeAttribute("inert");
        backgroundRoot.removeAttribute("aria-hidden");
      };
    }

    backgroundRoot.removeAttribute("inert");
    backgroundRoot.removeAttribute("aria-hidden");
    return undefined;
  }, [open, shieldActive]);

  if (!isClient || typeof document === "undefined") return null;
  void portalStoreVersion;
  const portalHost = document.querySelector(
    "div[data-mobile-sidebar-drawer=\"1\"]"
  );
  if (!portalHost) return null;
  const closeButtonClassName =
    closeButtonVariant === "soft"
      ? "rounded-full border border-slate-100 bg-white p-2 text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
      : "rounded-full border border-[var(--yb-border)] bg-white p-2 text-[var(--yb-text)] transition hover:bg-black/5";
  const headerClassName =
    closeButtonVariant === "soft"
      ? "yb-sidebar-header flex items-start justify-between gap-4 px-5 py-4"
      : "yb-sidebar-header flex items-center justify-between px-5 py-4";
  const titleClassName =
    closeButtonVariant === "soft"
      ? "text-[15px] font-semibold leading-tight"
      : "text-sm font-semibold";
  const subtitleClassName =
    closeButtonVariant === "soft"
      ? "mt-1 max-w-[250px] text-[12px] leading-5 yb-dropdown-muted"
      : "text-[11px] yb-dropdown-muted";

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] pointer-events-none"
      aria-hidden={!open}
    >
      <div
        className={`absolute inset-0 bg-black/60 md:bg-black/0 transition-opacity duration-200 pointer-events-none ${
          open ? "opacity-100" : "opacity-0"
        }`}
        data-testid="mobile-sidebar-overlay"
      />
      <div
        ref={sidebarRef}
        className={`pointer-events-auto absolute inset-y-0 left-0 w-[88vw] max-w-[360px] transform overflow-y-auto transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ WebkitOverflowScrolling: "touch" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={showHeader ? titleId : undefined}
          aria-label={!showHeader ? title : undefined}
          id={panelId}
          tabIndex={-1}
          className="yb-sidebar-panel yb-dropdown-surface flex h-full flex-col border-r border-[var(--yb-border)]"
        >
          {showHeader ? (
            <div className={headerClassName}>
              <div className="min-w-0">
                <div id={titleId} className={titleClassName}>
                  {title}
                </div>
                {subtitle ? (
                  <div className={subtitleClassName}>
                    {subtitle}
                  </div>
                ) : null}
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className={closeButtonClassName}
                data-mobile-drawer-close={closeButtonVariant}
                aria-label="Close menu"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor">
                  <path strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className={`absolute right-4 top-4 z-10 ${closeButtonClassName}`}
              data-mobile-drawer-close={closeButtonVariant}
              aria-label="Close menu"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor">
                <path strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <div className={`flex-1 overflow-y-auto px-5 ${showHeader ? "py-5" : "pb-5 pt-4"}`}>
            {children}
          </div>
          {footer ? <div className="border-t border-white/10 px-5 py-4">{footer}</div> : null}
        </div>
      </div>
    </div>,
    portalHost
  );
}
