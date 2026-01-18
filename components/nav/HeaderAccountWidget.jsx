"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bookmark,
  ChevronDown,
  LogOut,
  MessageSquare,
  Settings,
} from "lucide-react";
import SafeImage from "@/components/SafeImage";
import { useAuth } from "@/components/AuthProvider";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";
import { useModal } from "@/components/modals/ModalProvider";
import MobileSidebarDrawer from "@/components/nav/MobileSidebarDrawer";
import { fetchUnreadTotal } from "@/lib/messages";
import { resolveImageSrc } from "@/lib/safeImage";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient";

export default function HeaderAccountWidget({
  surface = "public",
  variant = "desktop",
  mobileMenuOpen = false,
  onCloseMobileMenu,
  mobileDrawerId,
}) {
  const { supabase, user, profile, role, authStatus, rateLimited, rateLimitMessage } =
    useAuth();
  const { openModal } = useModal();
  const loading = authStatus === "loading";
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);
  const lastUnreadUserIdRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const unreadRequestIdRef = useRef(0);

  const client = supabase ?? getBrowserSupabaseClient();

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

  const unreadUserId = accountUser?.id || accountProfile?.id;
  const loadUnreadCount = useCallback(async () => {
    if (!client || !unreadUserId || !isCustomer) return;
    const requestId = ++unreadRequestIdRef.current;
    try {
      const total = await fetchUnreadTotal({
        supabase: client,
        userId: unreadUserId,
        role: "customer",
      });
      if (requestId !== unreadRequestIdRef.current) return;
      setUnreadCount(total);
    } catch {
      // best effort
    }
  }, [client, unreadUserId, isCustomer]);

  const scheduleUnreadRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      void loadUnreadCount();
    }, 0);
  }, [loadUnreadCount]);

  useEffect(() => {
    if (!hasAuth || !isCustomer || !unreadUserId) return undefined;
    if (lastUnreadUserIdRef.current === unreadUserId) return undefined;
    lastUnreadUserIdRef.current = unreadUserId;
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
  }, [hasAuth, isCustomer, scheduleUnreadRefresh, unreadUserId]);

  useEffect(() => {
    if (!hasAuth || !isCustomer || !client) return undefined;
    if (!unreadUserId) return undefined;
    const channel = client
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
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [hasAuth, isCustomer, client, unreadUserId, loadUnreadCount]);

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

  const desktopSkeleton = (
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-2xl bg-white/10 border border-white/10" />
      <div className="h-4 w-20 rounded bg-white/10" />
    </div>
  );

  const quickActions = [
    {
      href: "/customer/messages",
      title: "Messages",
      description: "Chat with local businesses",
      icon: MessageSquare,
      showBadge: true,
    },
    {
      href: "/customer/saved",
      title: "Saved items",
      description: "Instant access to your favorites",
      icon: Bookmark,
    },
  ];

  if (variant === "desktop") {
    if (rateLimited) {
      return (
        <div className="text-sm text-white/70" aria-live="polite">
          {rateLimitMessage || "Temporarily rate-limited. Please wait a moment."}
        </div>
      );
    }
    if (loading) return desktopSkeleton;

    if (!hasAuth) {
      return (
        <>
          <button
            type="button"
            onClick={() => openModal("customer-login")}
            className="text-sm md:text-base transition text-white/70 hover:text-white"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => openModal("customer-signup")}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 text-white font-semibold"
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
            <SafeImage
              src={avatar}
              alt="Profile avatar"
              className="h-10 w-10 rounded-2xl object-cover border border-white/20"
            />
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
        {rateLimited ? (
          <div className="text-sm text-white/70" aria-live="polite">
            {rateLimitMessage || "Temporarily rate-limited. Please wait a moment."}
          </div>
        ) : loading ? (
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="h-11 w-11 rounded-2xl bg-white/10" />
            <div className="h-4 w-24 rounded bg-white/10" />
          </div>
        ) : !hasAuth ? (
          <>
            <button
              type="button"
              onClick={() => {
                onCloseMobileMenu?.();
                openModal("customer-login");
              }}
              className="text-left text-white/70 hover:text-white"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                onCloseMobileMenu?.();
                openModal("customer-signup");
              }}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 rounded-xl text-center font-semibold"
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
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                {email ? <p className="text-xs text-white/60 truncate">{email}</p> : null}
              </div>
            </div>

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
                  href="/customer/messages"
                  onClick={() => onCloseMobileMenu?.()}
                  className="text-left text-white/70 hover:text-white flex items-center justify-between"
                  data-safe-nav="1"
                >
                  <span>Messages</span>
                  {unreadCount > 0 ? (
                    <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                      {unreadCount}
                    </span>
                  ) : null}
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
