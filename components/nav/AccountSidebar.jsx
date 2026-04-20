"use client";

import { useEffect, useId, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import SafeAvatar from "@/components/SafeAvatar";
import useBodyScrollLock from "@/components/nav/useBodyScrollLock";

let portalVersion = 0;
const portalListeners = new Set();
let accountSidebarOpenCount = 0;

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

export default function AccountSidebar({
  open,
  onOpenChange,
  anchorRef,
  title = "Your Account",
  showTitle = true,
  profileFirst = false,
  premiumCustomer = false,
  premiumBusiness = false,
  avatarShape = "circle",
  displayName,
  businessName,
  email,
  avatar,
  children,
  shieldActive = false,
  scrollLockMode = "fixed",
  backgroundRootSelector,
}) {
  const reactId = useId();
  const panelId = `account-sidebar-${reactId}`;
  const titleId = `${panelId}-title`;
  const panelRef = useRef(null);
  const sidebarRef = useRef(null);
  const closeButtonRef = useRef(null);
  const lastActiveRef = useRef(null);
  const wasOpenRef = useRef(open);
  const portalNodeRef = useRef(null);
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

  useBodyScrollLock(open, {
    disableBackgroundScroll: false,
    mode: scrollLockMode,
  });

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (portalNodeRef.current) return undefined;
    const node = document.createElement("div");
    node.dataset.accountSidebar = "1";
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
    if (!open) return;
    lastActiveRef.current = anchorRef?.current || document.activeElement;
    requestAnimationFrame(() => {
      if (closeButtonRef.current) {
        closeButtonRef.current.focus();
        return;
      }
      panelRef.current?.focus();
    });
  }, [open, anchorRef]);

  useEffect(() => {
    if (!wasOpenRef.current || open) {
      wasOpenRef.current = open;
      return;
    }
    const anchorEl = anchorRef?.current || lastActiveRef.current;
    if (anchorEl && typeof anchorEl.focus === "function") {
      requestAnimationFrame(() => anchorEl.focus());
    }
    wasOpenRef.current = open;
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (event.button !== 0) return;
      const sidebarEl = sidebarRef.current;
      if (!sidebarEl) return;
      if (!sidebarEl.contains(event.target)) {
        onOpenChange?.(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange?.(false);
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
  }, [open, onOpenChange]);

  useLayoutEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    accountSidebarOpenCount += 1;
    document.documentElement.dataset.sidebarOpen = "1";
    return () => {
      accountSidebarOpenCount = Math.max(0, accountSidebarOpenCount - 1);
      if (accountSidebarOpenCount === 0) {
        delete document.documentElement.dataset.sidebarOpen;
      }
    };
  }, [open]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const selectedBackgroundRoot = backgroundRootSelector
      ? document.querySelector(backgroundRootSelector)
      : null;
    const backgroundRoot =
      selectedBackgroundRoot ||
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
  }, [backgroundRootSelector, open, shieldActive]);

  if (!isClient || typeof document === "undefined") return null;
  void portalStoreVersion;
  const portalHost = document.querySelector("div[data-account-sidebar=\"1\"]");
  if (!portalHost) return null;
  const fallbackSrc = premiumCustomer ? "/customer-placeholder.png" : "/business-placeholder.png";
  const polishedIdentity = premiumCustomer || premiumBusiness;
  const avatarNode = (
    <SafeAvatar
      src={avatar}
      name={displayName}
      displayName={displayName}
      businessName={businessName}
      email={email}
      shape={avatarShape}
      identityType={premiumBusiness ? "business" : "person"}
      alt="Profile avatar"
      fallbackSrc={fallbackSrc}
      className={`object-cover object-center ${
        premiumBusiness ? "h-[52px] w-[52px]" : "h-12 w-12"
      } ${
        polishedIdentity
          ? "border border-gray-100 bg-gray-200 shadow-sm ring-1 ring-gray-300"
          : "border border-[var(--yb-border)]"
      }`}
      initialsClassName="text-[15px]"
      width={premiumBusiness ? 52 : 48}
      height={premiumBusiness ? 52 : 48}
    />
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] pointer-events-none"
      aria-hidden={!open}
    >
      <div
        className={`absolute inset-0 bg-black/60 md:bg-black/0 transition-opacity duration-200 pointer-events-none ${
          open ? "opacity-100" : "opacity-0"
        }`}
        data-testid="account-sidebar-overlay"
      />
      <div
        ref={sidebarRef}
        className={`pointer-events-auto absolute inset-y-0 right-0 w-[380px] max-w-[90vw] transform overflow-y-auto transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ WebkitOverflowScrolling: "touch" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          id={panelId}
          tabIndex={-1}
          className="yb-sidebar-panel flex h-full flex-col border-l border-[var(--yb-border)]"
        >
          {profileFirst ? (
            <>
              <div
                className={`yb-sidebar-header flex items-center justify-start px-6 py-3 ${
                  polishedIdentity ? "border-b border-gray-100 bg-white/80 backdrop-blur" : ""
                }`}
              >
                <span id={titleId} className="sr-only">
                  {title}
                </span>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => onOpenChange?.(false)}
                  className={`rounded-full border bg-white p-2 transition hover:bg-black/5 ${
                    polishedIdentity
                      ? "border-gray-200 text-gray-500 hover:text-gray-900"
                      : "border-[var(--yb-border)] text-[var(--yb-text)]"
                  }`}
                  aria-label="Close account menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div
                className={`flex items-center gap-3 border-b px-6 pb-6 pt-5 ${
                  polishedIdentity ? "border-gray-100" : "border-[var(--yb-border)]"
                }`}
              >
                {avatarNode}
                <div className="min-w-0">
                  <p
                    className={
                      polishedIdentity
                        ? "truncate text-[15px] font-semibold text-gray-900"
                        : "truncate text-sm font-semibold"
                    }
                  >
                    {displayName}
                  </p>
                  {email ? (
                    <p
                      className={
                        polishedIdentity
                          ? "truncate text-[13px] text-gray-500"
                          : "truncate text-xs yb-dropdown-muted"
                      }
                    >
                      {email}
                    </p>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <>
              <div
                className={`yb-sidebar-header flex items-start justify-between px-6 py-5 ${
                  polishedIdentity ? "border-b border-gray-100 bg-white/80 backdrop-blur" : ""
                }`}
              >
                <div>
                  {showTitle ? (
                    <>
                      <div
                        id={titleId}
                        className={
                          polishedIdentity
                            ? "text-[15px] font-semibold text-gray-900"
                            : "text-sm font-semibold"
                        }
                      >
                        {title}
                      </div>
                      <div
                        className={
                          polishedIdentity
                            ? "mt-1 text-[13px] text-gray-500"
                            : "mt-1 text-xs yb-dropdown-muted"
                        }
                      >
                        YourBarrio
                      </div>
                    </>
                  ) : (
                    <span id={titleId} className="sr-only">
                      {title}
                    </span>
                  )}
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => onOpenChange?.(false)}
                  className={`rounded-full border bg-white p-2 transition hover:bg-black/5 ${
                    polishedIdentity
                      ? "border-gray-200 text-gray-500 hover:text-gray-900"
                      : "border-[var(--yb-border)] text-[var(--yb-text)]"
                  }`}
                  aria-label="Close account menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div
                className={`flex items-center gap-3 border-b px-6 py-4 ${
                  polishedIdentity ? "border-gray-100" : "border-[var(--yb-border)]"
                }`}
              >
                {avatarNode}
                <div className="min-w-0">
                  <p
                    className={
                      polishedIdentity
                        ? "truncate text-[15px] font-semibold text-gray-900"
                        : "truncate text-sm font-semibold"
                    }
                  >
                    {displayName}
                  </p>
                  {email ? (
                    <p
                      className={
                        polishedIdentity
                          ? "truncate text-[13px] text-gray-500"
                          : "truncate text-xs yb-dropdown-muted"
                      }
                    >
                      {email}
                    </p>
                  ) : null}
                </div>
              </div>
            </>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        </div>
      </div>
    </div>,
    portalHost
  );
}
