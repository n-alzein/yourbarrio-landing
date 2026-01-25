"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  ChevronDown,
  Compass,
  Home,
  LogOut,
  MapPin,
  MessageSquare,
  ShoppingCart,
  Settings,
} from "lucide-react";
import SafeImage from "@/components/SafeImage";
import { AUTH_UI_RESET_EVENT, useAuth } from "@/components/AuthProvider";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";
import { useModal } from "@/components/modals/ModalProvider";
import MobileSidebarDrawer from "@/components/nav/MobileSidebarDrawer";
import { useCart } from "@/components/cart/CartProvider";
import { fetchUnreadTotal } from "@/lib/messages";
import { resolveImageSrc } from "@/lib/safeImage";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useRealtimeChannel } from "@/lib/realtime/useRealtimeChannel";

const UNREAD_REFRESH_EVENT = "yb-unread-refresh";

export default function HeaderAccountWidget({
  surface = "public",
  variant = "desktop",
  mobileMenuOpen = false,
  onCloseMobileMenu,
  mobileDrawerId,
}) {
  const {
    supabase,
    user,
    profile,
    role,
    authStatus,
    rateLimited,
    rateLimitMessage,
    authBusy,
    authAction,
    authAttemptId,
    lastAuthEvent,
    providerInstanceId,
  } = useAuth();
  const { itemCount } = useCart();
  const { openModal } = useModal();
  const authDiagEnabled =
    process.env.NEXT_PUBLIC_AUTH_DIAG === "1" &&
    process.env.NODE_ENV !== "production";
  const loading = authStatus === "loading";
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [locationValue, setLocationValue] = useState("Your city");
  const dropdownRef = useRef(null);
  const lastUnreadKeyRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const unreadRequestIdRef = useRef(0);

  const accountUser = user;
  const accountProfile = profile;
  const isCustomer = !role || role === "customer" || role === "admin" || role === "internal";
  const isBusiness = role === "business";

  const avatar = resolveImageSrc(
    accountProfile?.profile_photo_url?.trim() ||
      accountUser?.user_metadata?.avatar_url ||
      "",
    "/customer-placeholder.png"
  );

  const displayName =
    accountProfile?.full_name ||
    accountProfile?.business_name ||
    accountUser?.user_metadata?.full_name ||
    accountUser?.user_metadata?.name ||
    accountUser?.email ||
    "Account";

  const email = accountProfile?.email || accountUser?.email || null;
  const hasAuth = Boolean(accountUser);
  const disableCtas = authBusy || loading;
  const showRateLimit = rateLimited && hasAuth;

  const unreadUserId = accountUser?.id || accountProfile?.id;
  const canLoadUnread =
    Boolean(unreadUserId) &&
    isCustomer &&
    (authStatus === "authenticated" || (authStatus === "loading" && hasAuth));
  const loadUnreadCount = useCallback(async () => {
    const activeClient = supabase ?? getSupabaseBrowserClient();
    if (!activeClient || !canLoadUnread) {
      return;
    }
    const requestId = ++unreadRequestIdRef.current;
    try {
      const total = await fetchUnreadTotal({
        supabase: activeClient,
        userId: unreadUserId,
        role: "customer",
      });
      if (requestId !== unreadRequestIdRef.current) return;
      setUnreadCount(total);
    } catch {
      // best effort
    }
  }, [supabase, canLoadUnread]);

  const scheduleUnreadRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      void loadUnreadCount();
    }, 0);
  }, [loadUnreadCount]);

  useEffect(() => {
    if (!hasAuth || !isCustomer || !unreadUserId || authStatus === "unauthenticated") {
      return undefined;
    }
    const key = `${unreadUserId}:${authStatus}`;
    if (lastUnreadKeyRef.current === key) return undefined;
    lastUnreadKeyRef.current = key;
    scheduleUnreadRefresh();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        scheduleUnreadRefresh();
      }
    };
    window.addEventListener("focus", scheduleUnreadRefresh);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", scheduleUnreadRefresh);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [hasAuth, isCustomer, scheduleUnreadRefresh, unreadUserId, authStatus]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cached = window.localStorage.getItem("yb-city");
    if (cached) {
      queueMicrotask(() => {
        setLocationValue(cached);
      });
    }
  }, []);

  const buildUnreadChannel = useCallback(
    (scopedClient) =>
      scopedClient
        .channel(`customer-unread-${unreadUserId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "conversations",
            filter: `customer_id=eq.${unreadUserId}`,
          },
          () => {
            loadUnreadCount();
          }
        ),
    [unreadUserId, loadUnreadCount]
  );

  useRealtimeChannel({
    supabase,
    enabled:
      hasAuth && isCustomer && authStatus === "authenticated" && Boolean(unreadUserId),
    buildChannel: buildUnreadChannel,
    diagLabel: "header-unread",
  });

  useEffect(() => {
    if (!profileMenuOpen) return;
    const handleClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleUnreadRefresh = () => {
      loadUnreadCount();
    };
    window.addEventListener(UNREAD_REFRESH_EVENT, handleUnreadRefresh);
    return () => window.removeEventListener(UNREAD_REFRESH_EVENT, handleUnreadRefresh);
  }, [loadUnreadCount]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleReset = () => {
      setProfileMenuOpen(false);
    };
    window.addEventListener(AUTH_UI_RESET_EVENT, handleReset);
    return () => window.removeEventListener(AUTH_UI_RESET_EVENT, handleReset);
  }, []);

  useEffect(() => {
    if (!authDiagEnabled) return;
    console.log("[AUTH_DIAG] cta:HeaderAccountWidget", {
      providerInstanceId,
      authStatus,
      hasAuth,
      authBusy,
      authAction,
      authAttemptId,
      lastAuthEvent,
      disableCtas,
    });
  });

  useEffect(() => {
    if (!authDiagEnabled) return undefined;
    if (typeof window === "undefined") return undefined;

    const describeNode = (node) => {
      if (!node || !node.tagName) return null;
      const id = node.id ? `#${node.id}` : "";
      const className =
        typeof node.className === "string" && node.className.trim()
          ? `.${node.className.trim().split(/\s+/).slice(0, 3).join(".")}`
          : "";
      return `${node.tagName.toLowerCase()}${id}${className}`;
    };

    const logStyleChain = (el, label) => {
      const chain = [];
      let current = el;
      let depth = 0;
      while (current && depth < 7) {
        const style = window.getComputedStyle(current);
        chain.push({
          label: depth === 0 ? label : `parent-${depth}`,
          node: describeNode(current),
          pointerEvents: style.pointerEvents,
          opacity: style.opacity,
          position: style.position,
          zIndex: style.zIndex,
        });
        if (current.tagName?.toLowerCase() === "body") break;
        current = current.parentElement;
        depth += 1;
      }
      return chain;
    };

    const login = document.querySelector("[data-public-cta='signin']");
    const signup = document.querySelector("[data-public-cta='signup']");
    const modalDialog = document.querySelector("[aria-modal='true']");
    const drawerHost = document.querySelector("div[data-mobile-sidebar-drawer='1']");
    const overlayPresent = Boolean(modalDialog || drawerHost);

    const diagDisableReasons = [
      authBusy ? "authBusy" : null,
      loading && !hasAuth ? "authStatus=loading" : null,
      profileMenuOpen ? "profileMenuOpen" : null,
      overlayPresent ? "overlayPresent" : null,
      login?.disabled ? "signin.disabled" : null,
      login?.getAttribute?.("aria-disabled") ? "signin.aria-disabled" : null,
      signup?.disabled ? "signup.disabled" : null,
      signup?.getAttribute?.("aria-disabled") ? "signup.aria-disabled" : null,
    ].filter(Boolean);

    console.log("[AUTH_DIAG] cta:HeaderAccountWidget:render", {
      providerInstanceId,
      authStatus,
      hasAuth,
      authBusy,
      authAction,
      authAttemptId,
      lastAuthEvent,
      disableCtas,
      diagDisableReasons,
      loginStyle: login ? logStyleChain(login, "signin") : null,
      signupStyle: signup ? logStyleChain(signup, "signup") : null,
      overlayPresent,
      overlayNodes: {
        modalDialog: modalDialog ? describeNode(modalDialog) : null,
        drawerHost: drawerHost ? describeNode(drawerHost) : null,
      },
    });
  });

  const desktopSkeleton = (
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-2xl bg-white/10 border border-white/10" />
      <div className="h-4 w-20 rounded bg-white/10" />
    </div>
  );

  const quickActions = [
    {
      href: "/customer/home",
      title: "YB Home",
      description: "Back to customer home",
      icon: Home,
    },
    {
      href: "/customer/nearby",
      title: "Nearby businesses",
      description: "Explore what's buzzing near you",
      icon: Compass,
    },
    {
      href: "/customer/messages",
      title: "Messages",
      description: "Chat with local businesses",
      icon: MessageSquare,
      showBadge: true,
    },
    {
      href: "/account/orders",
      title: "My Orders",
      description: "Track active requests",
      icon: ShoppingCart,
    },
    {
      href: "/account/purchase-history",
      title: "Purchase History",
      description: "Review fulfilled orders",
      icon: Bookmark,
    },
    {
      href: "/customer/saved",
      title: "Saved items",
      description: "Instant access to your favorites",
      icon: Bookmark,
    },
  ];

  if (variant === "desktop") {
    if (showRateLimit) {
      return (
        <div className="text-sm text-white/70" aria-live="polite">
          {rateLimitMessage || "Temporarily rate-limited. Please wait a moment."}
        </div>
      );
    }
    if (loading && !hasAuth) return desktopSkeleton;

    if (!hasAuth) {
      return (
        <>
          <button
            type="button"
            onClick={() => openModal("customer-login")}
            disabled={disableCtas}
            aria-busy={disableCtas}
            className={`text-sm md:text-base transition text-white/70 hover:text-white ${
              disableCtas ? "opacity-60 cursor-not-allowed" : ""
            }`}
            data-public-cta="signin"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => openModal("customer-signup")}
            disabled={disableCtas}
            aria-busy={disableCtas}
            className={`px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 text-white font-semibold ${
              disableCtas ? "opacity-60 cursor-not-allowed" : ""
            }`}
            data-public-cta="signup"
          >
            Sign up
          </button>
        </>
      );
    }

    return (
      <div className="flex items-center gap-3">
        {isBusiness ? (
          <Link
            href="/business/dashboard"
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white/90 border border-white/20 hover:bg-white/10 transition"
          >
            Dashboard
          </Link>
        ) : null}
        <div className="relative" ref={dropdownRef} data-nav-guard="1">
          <button
            onClick={() => setProfileMenuOpen((open) => !open)}
            className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-1.5 backdrop-blur-sm border border-white/10 hover:border-white/30 transition"
            data-nav-guard="1"
          >
            <span className="relative">
              <SafeImage
                src={avatar}
                alt="Profile avatar"
                className="h-10 w-10 rounded-2xl object-cover border border-white/20"
                width={40}
                height={40}
                sizes="40px"
                useNextImage
                priority
              />
              {unreadCount > 0 ? (
                <span className="absolute -bottom-1 -left-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white shadow-lg shadow-rose-900/40">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </span>
            <span className="hidden sm:block text-sm font-semibold text-white/90 max-w-[120px] truncate">
              {displayName}
            </span>
            <ChevronDown className="h-4 w-4 text-white/70" />
          </button>

          {profileMenuOpen ? (
            <div
              className="absolute right-0 mt-4 w-80 rounded-3xl border border-white/15 bg-[#0d041c]/95 px-1.5 pb-3 pt-1.5 shadow-2xl shadow-purple-950/30 backdrop-blur-2xl z-[5100]"
              data-nav-guard="1"
            >
              <div className="rounded-[26px] bg-gradient-to-br from-white/8 via-white/5 to-white/0">
                <div className="flex items-center gap-3 px-4 py-4">
                  <SafeImage
                    src={avatar}
                    alt="Profile avatar"
                    className="h-12 w-12 rounded-2xl object-cover border border-white/20 shadow-inner shadow-black/50"
                    width={48}
                    height={48}
                    sizes="48px"
                    useNextImage
                  />
                  <div>
                    <p className="text-sm font-semibold text-white">{displayName}</p>
                    {email ? <p className="text-xs text-white/60">{email}</p> : null}
                  </div>
                </div>

                <div className="px-2 pb-1 pt-2 space-y-1">
                  {isCustomer
                    ? quickActions.map(({ href, title, description, icon: Icon, showBadge }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setProfileMenuOpen(false)}
                          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-white/10 touch-manipulation text-left"
                          data-safe-nav="1"
                        >
                          <div className="h-11 w-11 rounded-2xl bg-white/10 flex items-center justify-center text-white">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-white/90">{title}</p>
                              {showBadge && unreadCount > 0 ? (
                                <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                                  {unreadCount}
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs text-white/60">{description}</p>
                          </div>
                        </Link>
                      ))
                    : null}

                  {isBusiness ? (
                    <Link
                      href="/business/dashboard"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-white/10 touch-manipulation text-left"
                      data-safe-nav="1"
                    >
                      <div className="h-11 w-11 rounded-2xl bg-white/10 flex items-center justify-center text-white">
                        <Settings className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white/90">Business dashboard</p>
                        <p className="text-xs text-white/60">Manage your storefront</p>
                      </div>
                    </Link>
                  ) : null}
                </div>

                <div className="mt-2 border-t border-white/10 px-4 pt-3">
                  <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                    <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                      Theme
                    </span>
                    <ThemeToggle
                      buttonClassName="px-2.5 py-1.5 text-[11px] font-medium text-white/70 border-white/10 bg-white/5 hover:bg-white/10"
                    />
                  </div>
                  {isCustomer ? (
                    <Link
                      href="/customer/settings"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex w-full items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10 touch-manipulation text-left"
                      data-safe-nav="1"
                    >
                      <span className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Account settings
                      </span>
                    </Link>
                  ) : null}
                  <LogoutButton
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-900/30 transition hover:opacity-90"
                    onSuccess={() => setProfileMenuOpen(false)}
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </LogoutButton>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <MobileSidebarDrawer
      open={mobileMenuOpen}
      onClose={() => onCloseMobileMenu?.()}
      title={hasAuth ? "My account" : "Welcome"}
      id={mobileDrawerId}
    >
      <div
        className="flex flex-col gap-5 text-white"
        data-nav-surface={surface}
        data-nav-guard="1"
      >
        {showRateLimit ? (
          <div className="text-sm text-white/70" aria-live="polite">
            {rateLimitMessage || "Temporarily rate-limited. Please wait a moment."}
          </div>
        ) : !hasAuth ? (
          <>
            <button
              type="button"
              onClick={() => {
                onCloseMobileMenu?.();
                openModal("customer-login");
              }}
              disabled={disableCtas}
              aria-busy={disableCtas}
              className={`w-full text-center text-white/70 hover:text-white ${
                disableCtas ? "opacity-60 cursor-not-allowed" : ""
              }`}
              data-public-cta="signin"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                onCloseMobileMenu?.();
                openModal("customer-signup");
              }}
              disabled={disableCtas}
              aria-busy={disableCtas}
              className={`px-4 py-2 bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 rounded-xl text-center font-semibold ${
                disableCtas ? "opacity-60 cursor-not-allowed" : ""
              }`}
              data-public-cta="signup"
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <SafeImage
                src={avatar}
                alt="Profile avatar"
                className="h-11 w-11 rounded-2xl object-cover border border-white/20"
                width={44}
                height={44}
                sizes="44px"
                useNextImage
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                {email ? <p className="text-xs text-white/60 truncate">{email}</p> : null}
              </div>
            </div>

            {isCustomer ? (
              <div className="flex items-center gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <MapPin className="h-4 w-4 text-white/80" />
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/50">Location</p>
                    <p className="text-sm font-semibold text-white truncate">{locationValue}</p>
                  </div>
                </div>
                <Link
                  href="/cart"
                  onClick={() => onCloseMobileMenu?.()}
                  className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/90 transition hover:text-white"
                  aria-label="View cart"
                  data-safe-nav="1"
                >
                  <ShoppingCart className="h-5 w-5" />
                  {itemCount > 0 ? (
                    <span className="absolute -top-2 -right-2 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold text-black">
                      {itemCount}
                    </span>
                  ) : null}
                </Link>
              </div>
            ) : null}

            {isBusiness ? (
              <Link
                href="/business/dashboard"
                onClick={() => onCloseMobileMenu?.()}
                className="text-left text-white/70 hover:text-white"
                data-safe-nav="1"
              >
                Business dashboard
              </Link>
            ) : null}

            {isCustomer ? (
              <>
                <Link
                  href="/customer/home"
                  onClick={() => onCloseMobileMenu?.()}
                  className="text-left text-white/70 hover:text-white"
                  data-safe-nav="1"
                >
                  YB Home
                </Link>
                <Link
                  href="/customer/nearby"
                  onClick={() => onCloseMobileMenu?.()}
                  className="text-left text-white/70 hover:text-white"
                  data-safe-nav="1"
                >
                  Nearby businesses
                </Link>
                <Link
                  href="/customer/messages"
                  onClick={() => onCloseMobileMenu?.()}
                  className="text-left text-white/70 hover:text-white flex items-center justify-between"
                  data-safe-nav="1"
                >
                  <span className="inline-flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Messages
                  </span>
                  {unreadCount > 0 ? (
                    <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                      {unreadCount}
                    </span>
                  ) : null}
                </Link>
                <Link
                  href="/account/orders"
                  onClick={() => onCloseMobileMenu?.()}
                  className="text-left text-white/70 hover:text-white"
                  data-safe-nav="1"
                >
                  My Orders
                </Link>
                <Link
                  href="/account/purchase-history"
                  onClick={() => onCloseMobileMenu?.()}
                  className="text-left text-white/70 hover:text-white"
                  data-safe-nav="1"
                >
                  Purchase History
                </Link>
                <Link
                  href="/customer/saved"
                  onClick={() => onCloseMobileMenu?.()}
                  className="text-left text-white/70 hover:text-white"
                  data-safe-nav="1"
                >
                  Saved items
                </Link>
                <Link
                  href="/customer/settings"
                  onClick={() => onCloseMobileMenu?.()}
                  className="text-left text-white/70 hover:text-white"
                  data-safe-nav="1"
                >
                  Account settings
                </Link>
              </>
            ) : null}
          </>
        )}

        <ThemeToggle
          showLabel
          align="left"
          className="self-start"
          buttonClassName="px-2.5 py-1.5 text-[11px] font-medium text-white/70 border-white/10 bg-white/5 hover:bg-white/10"
        />

        {hasAuth ? <LogoutButton mobile onSuccess={() => onCloseMobileMenu?.()} /> : null}
      </div>
    </MobileSidebarDrawer>
  );
}
