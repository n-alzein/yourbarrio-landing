"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  Building2,
  Bell,
  LayoutDashboard,
  LogOut,
  PackageSearch,
  MessageSquare,
  Settings,
  Store,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import LogoutButton from "@/components/LogoutButton";
import MobileSidebarDrawer from "@/components/nav/MobileSidebarDrawer";
import { openBusinessAuthPopup } from "@/lib/openBusinessAuthPopup";
import { fetchUnreadTotal } from "@/lib/messages";
import { resolveImageSrc } from "@/lib/safeImage";
import SafeImage from "@/components/SafeImage";
import { useRealtimeChannel } from "@/lib/realtime/useRealtimeChannel";
import { AUTH_UI_RESET_EVENT } from "@/components/AuthProvider";

const UNREAD_REFRESH_EVENT = "yb-unread-refresh";

function NavItem({
  href,
  children,
  onClick,
  isActive,
  closeMenus,
  badgeCount,
  disabled = false,
  ...rest
}) {
  return (
    <Link
      href={href}
      onClick={(e) => {
        if (disabled) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onClick?.(e);
        closeMenus?.();
      }}
      className={`text-sm md:text-base transition ${
        isActive?.(href)
          ? "text-white font-semibold"
          : "text-white/70 hover:text-white"
      } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      {...rest}
    >
      <span className="flex items-center gap-2">
        {children}
        {badgeCount > 0 ? (
          <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white">
            {badgeCount}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function BusinessNavbarInner({ pathname }) {
  const router = useRouter();
  const {
    user,
    profile,
    role,
    loadingUser,
    supabase,
    authStatus,
    authBusy,
    authAction,
    authAttemptId,
    lastAuthEvent,
    providerInstanceId,
  } = useAuth();
  const authDiagEnabled =
    process.env.NEXT_PUBLIC_AUTH_DIAG === "1" &&
    process.env.NODE_ENV !== "production";

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const mobileDrawerId = useId();
  const dropdownRef = useRef(null);
  const notificationsRef = useRef(null);
  const displayName =
    profile?.business_name ||
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    "Account";

  const badgeReady = !loadingUser;

  useEffect(() => {
    if (!profileMenuOpen) return;
    const handleClick = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
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
    if (!notificationsOpen) return;
    const handleClick = (event) => {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target)
      ) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
    };
  }, [notificationsOpen]);

  /* Load avatar */
  useEffect(() => {
    async function loadPhoto() {
      if (!user || !supabase) {
        setPhotoUrl(null);
        return;
      }

      const { data } = await supabase
        .from("users")
        .select("profile_photo_url")
        .eq("id", user.id)
        .single();

      setPhotoUrl(data?.profile_photo_url ?? null);
    }
    loadPhoto();
  }, [user, supabase]);

  const avatar = resolveImageSrc(
    profile?.profile_photo_url?.trim() || photoUrl?.trim() || "",
    "/business-placeholder.png"
  );

  const isActive = (href) => pathname === href;
  const email =
    profile?.email ||
    user?.email ||
    user?.user_metadata?.email ||
    null;

  const handleBusinessAuthClick = (event, path) => {
    if (disableCtas) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    openBusinessAuthPopup(path);
  };

  const closeMenus = () => {
    setProfileMenuOpen(false);
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleReset = () => {
      setProfileMenuOpen(false);
      setMobileMenuOpen(false);
      setNotificationsOpen(false);
    };
    window.addEventListener(AUTH_UI_RESET_EVENT, handleReset);
    return () => window.removeEventListener(AUTH_UI_RESET_EVENT, handleReset);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(min-width: 768px)");
    const handleChange = () => {
      if (media.matches) setMobileMenuOpen(false);
    };
    handleChange();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  const quickActions = [
    {
      href: "/business/dashboard",
      title: "Open dashboard",
      description: "Monitor performance & leads",
      icon: LayoutDashboard,
    },
    {
      href: "/business/orders",
      title: "Orders",
      description: "Manage order requests",
      icon: PackageSearch,
    },
    {
      href: "/business/profile",
      title: "Business Profile",
      description: "Edit how customers see you",
      icon: Building2,
    },
    {
      href: "/business/messages",
      title: "Messages",
      description: "Reply to customer inquiries",
      icon: MessageSquare,
      showBadge: true,
    },
    {
      href: "/business/listings",
      title: "Manage listings",
      description: "Keep offers & hours fresh",
      icon: Store,
    },
  ];

  const canLoadUnread =
    Boolean(user?.id) && role === "business" && authStatus !== "unauthenticated";
  const loadUnreadCount = useCallback(async () => {
    const userId = user?.id;
    if (!userId || !canLoadUnread) return;
    try {
      const total = await fetchUnreadTotal({
        supabase,
        userId,
        role: "business",
      });
      setUnreadCount(total);
    } catch (err) {
      console.warn("Failed to load unread messages", err);
    }
  }, [supabase, user?.id, canLoadUnread]);

  useEffect(() => {
    if (!badgeReady || !canLoadUnread) return;
    queueMicrotask(() => {
      loadUnreadCount();
    });
  }, [badgeReady, canLoadUnread, loadUnreadCount]);

  const buildUnreadChannel = useCallback(
    (activeClient) =>
      activeClient
        .channel(`business-unread-${user?.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "conversations",
            filter: `business_id=eq.${user?.id}`,
          },
          () => {
            loadUnreadCount();
          }
        ),
    [user?.id, loadUnreadCount]
  );

  useRealtimeChannel({
    supabase,
    enabled:
      badgeReady &&
      authStatus === "authenticated" &&
      role === "business" &&
      Boolean(user?.id),
    buildChannel: buildUnreadChannel,
    diagLabel: "business-unread",
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleUnreadRefresh = () => {
      loadUnreadCount();
    };
    window.addEventListener(UNREAD_REFRESH_EVENT, handleUnreadRefresh);
    return () => window.removeEventListener(UNREAD_REFRESH_EVENT, handleUnreadRefresh);
  }, [loadUnreadCount]);

  const loadNotificationCount = useCallback(async () => {
    if (!supabase || !user?.id || role !== "business") return;
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_user_id", user.id)
      .is("read_at", null);
    setNotificationUnreadCount(count || 0);
  }, [supabase, user?.id, role]);

  const loadNotifications = useCallback(async () => {
    if (!supabase || !user?.id || role !== "business") return;
    setNotificationsLoading(true);
    try {
      const { data } = await supabase
        .from("notifications")
        .select("id,title,body,created_at,read_at,order_id")
        .eq("recipient_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(8);
      setNotifications(data || []);
    } finally {
      setNotificationsLoading(false);
    }
  }, [supabase, user?.id, role]);

  const markNotificationRead = useCallback(
    async (notificationId) => {
      if (!supabase || !user?.id) return;
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("recipient_user_id", user.id);
      loadNotificationCount();
      loadNotifications();
    },
    [supabase, user?.id, loadNotificationCount, loadNotifications]
  );

  useEffect(() => {
    if (!badgeReady || role !== "business") return;
    queueMicrotask(() => {
      loadNotificationCount();
      loadNotifications();
    });
  }, [badgeReady, role, loadNotificationCount, loadNotifications]);

  const buildNotificationsChannel = useCallback(
    (activeClient) =>
      activeClient
        .channel(`business-notifications-${user?.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `recipient_user_id=eq.${user?.id}`,
          },
          () => {
            loadNotificationCount();
            loadNotifications();
          }
        ),
    [user?.id, loadNotificationCount, loadNotifications]
  );

  useRealtimeChannel({
    supabase,
    enabled:
      badgeReady &&
      authStatus === "authenticated" &&
      role === "business" &&
      Boolean(user?.id),
    buildChannel: buildNotificationsChannel,
    diagLabel: "business-notifications",
  });

  const disableReasons = useMemo(() => {
    const reasons = [];
    if (authBusy && lastAuthEvent !== "SIGNED_OUT") {
      reasons.push("authBusy");
    }
    if (loadingUser && !user && lastAuthEvent !== "SIGNED_OUT") {
      reasons.push("loadingUser");
    }
    return reasons;
  }, [authBusy, lastAuthEvent, loadingUser, user]);
  const disableCtas = disableReasons.length > 0;

  useEffect(() => {
    if (!authDiagEnabled) return;
    console.log("[AUTH_DIAG] cta:BusinessNavbar", {
      providerInstanceId,
      authStatus,
      hasAuth: Boolean(user),
      authBusy,
      authAction,
      authAttemptId,
      lastAuthEvent,
      disableReasons,
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

    const login = document.querySelector("[data-business-cta='login']");
    const signup = document.querySelector("[data-business-cta='signup']");
    const modalDialog = document.querySelector("[aria-modal='true']");
    const drawerHost = document.querySelector("div[data-mobile-sidebar-drawer='1']");
    const overlayPresent = Boolean(modalDialog || drawerHost);

    const diagDisableReasons = [
      authBusy ? "authBusy" : null,
      loadingUser && !user ? "loadingUser" : null,
      authStatus === "loading" ? "authStatus=loading" : null,
      profileMenuOpen ? "profileMenuOpen" : null,
      mobileMenuOpen ? "mobileMenuOpen" : null,
      overlayPresent ? "overlayPresent" : null,
      login?.disabled ? "login.disabled" : null,
      login?.getAttribute?.("aria-disabled") ? "login.aria-disabled" : null,
      signup?.getAttribute?.("aria-disabled") ? "signup.aria-disabled" : null,
    ].filter(Boolean);

    console.log("[AUTH_DIAG] cta:BusinessNavbar:render", {
      providerInstanceId,
      authStatus,
      hasAuth: Boolean(user),
      authBusy,
      authAction,
      authAttemptId,
      lastAuthEvent,
      disableReasons,
      diagDisableReasons,
      loginStyle: login ? logStyleChain(login, "login") : null,
      signupStyle: signup ? logStyleChain(signup, "signup") : null,
      overlayPresent,
      overlayNodes: {
        modalDialog: modalDialog ? describeNode(modalDialog) : null,
        drawerHost: drawerHost ? describeNode(drawerHost) : null,
      },
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

    const getCtas = () => {
      const login =
        document.querySelector("[data-business-cta='login']") || null;
      const signup =
        document.querySelector("[data-business-cta='signup']") || null;
      return { login, signup };
    };

    const getOverlayNodes = () => {
      const drawerHost = document.querySelector("div[data-mobile-sidebar-drawer='1']");
      const modalRoot = document.getElementById("modal-root");
      const drawerRoot = drawerHost?.firstElementChild || null;
      const modalDialog = document.querySelector("[aria-modal='true']") || null;
      return [
        { label: "drawerHost", node: drawerHost },
        { label: "drawerRoot", node: drawerRoot },
        { label: "modalRoot", node: modalRoot },
        { label: "modalDialog", node: modalDialog },
      ];
    };

    const isInside = (target, el) => Boolean(el && target && el.contains(target));

    const handler = (event) => {
      const target = event.target;
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      const pathSummary = path
        .slice(0, 6)
        .map((node) => describeNode(node))
        .filter(Boolean);
      const { login, signup } = getCtas();
      const overlays = getOverlayNodes();
      const coords = {
        x: typeof event.clientX === "number" ? event.clientX : null,
        y: typeof event.clientY === "number" ? event.clientY : null,
      };
      const hit =
        coords.x !== null && coords.y !== null
          ? document.elementFromPoint(coords.x, coords.y)
          : null;

      console.log("[AUTH_DIAG] nav-click-capture", {
        type: event.type,
        target: describeNode(target),
        targetId: target?.id || null,
        targetClass: target?.className || null,
        path: pathSummary,
        elementFromPoint: describeNode(hit),
        coords,
        inLoginCta: isInside(target, login),
        inSignupCta: isInside(target, signup),
        inDrawerHost: overlays[0]?.node ? isInside(target, overlays[0].node) : false,
        inModalRoot: overlays[2]?.node ? isInside(target, overlays[2].node) : false,
        disableCtas,
      });

      if (login) {
        console.log("[AUTH_DIAG] cta-style:login", logStyleChain(login, "login"));
      }
      if (signup) {
        console.log("[AUTH_DIAG] cta-style:signup", logStyleChain(signup, "signup"));
      }
      overlays.forEach(({ label, node }) => {
        if (!node) return;
        const styles = window.getComputedStyle(node);
        console.log("[AUTH_DIAG] overlay-style", {
          label,
          node: describeNode(node),
          pointerEvents: styles.pointerEvents,
          opacity: styles.opacity,
          position: styles.position,
          zIndex: styles.zIndex,
        });
      });
    };

    window.addEventListener("pointerdown", handler, true);
    window.addEventListener("click", handler, true);
    return () => {
      window.removeEventListener("pointerdown", handler, true);
      window.removeEventListener("click", handler, true);
    };
  }, [authDiagEnabled, disableCtas]);

  const isBusinessAuthed = Boolean(user) && role === "business";

  /* ---------------------------------------------------
     NAVBAR
  --------------------------------------------------- */
  return (
    <nav
      className="fixed top-0 inset-x-0 z-50 theme-lock"
      data-business-navbar="1"
    >
      <div className="backdrop-blur-xl bg-gradient-to-r from-purple-950/80 via-purple-900/60 to-fuchsia-900/70 border-b border-white/10 shadow-lg">
        <div className="w-full px-5 sm:px-6 md:px-8 lg:px-10 xl:px-14 flex items-center justify-between h-20">
        {/* MOBILE LEFT GROUP */}
        <div className="flex items-center gap-3 md:hidden">
          <button
            onClick={() => {
              setProfileMenuOpen(false);
              setMobileMenuOpen((open) => !open);
            }}
            className="h-11 w-11 rounded-xl border border-white/15 bg-white/5 text-white flex items-center justify-center shadow-lg active:scale-[0.98] transition"
            aria-label="Open menu"
            aria-expanded={mobileMenuOpen}
            aria-controls={mobileDrawerId}
          >
            <svg className="h-7 w-7" fill="none" stroke="currentColor">
              <path strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link href={user ? "/business/dashboard" : "/business"}>
            <span className="relative block h-32 w-32">
              <Image
                src="/logo.png"
                alt="YourBarrio"
                fill
                sizes="128px"
                priority
                className="object-contain"
              />
            </span>
          </Link>

        </div>

        <div className="md:hidden text-[11px] font-semibold tracking-[0.2em] text-white/70 whitespace-nowrap">
          BUSINESS ACCOUNT
        </div>

        {/* LEFT SIDE */}
        <div className="hidden md:flex items-center gap-10">
          {/* Logo */}
          <div className="relative flex items-center">
            <Link href={user ? "/business/dashboard" : "/business"}>
              <span className="relative block h-32 w-32">
                <Image
                  src="/logo.png"
                  alt="YourBarrio"
                  fill
                  sizes="128px"
                  priority
                  className="object-contain"
                />
              </span>
            </Link>

          </div>

          {/* LEFT NAV LINKS */}
          <div className="hidden md:flex items-center gap-8 ml-8">
            {/* Show /business only when logged OUT */}
            {!isBusinessAuthed && (
              <NavItem
                href="/business"
                isActive={isActive}
                closeMenus={closeMenus}
              >
                Businesses
              </NavItem>
            )}

            {/* Logged-in business nav (LEFT SIDE) */}
            {isBusinessAuthed && null}

            {/* Logged-out → show About */}
            {!isBusinessAuthed && (
              <NavItem
                href="/business/about"
                isActive={isActive}
                closeMenus={closeMenus}
              >
                About
              </NavItem>
            )}
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="hidden md:flex items-center gap-8">
          <span className="text-[11px] font-semibold tracking-[0.3em] text-white/70 whitespace-nowrap">
            BUSINESS ACCOUNT
          </span>

          {/* Logged OUT */}
          {!isBusinessAuthed && (
            <>
              <NavItem
                href="/business-auth/login"
                onClick={(e) =>
                  handleBusinessAuthClick(e, "/business-auth/login")
                }
                isActive={isActive}
                closeMenus={closeMenus}
                disabled={disableCtas}
                data-business-cta="login"
              >
                Login
              </NavItem>
              <Link
                href="/business-auth/register"
                onClick={(e) =>
                  handleBusinessAuthClick(e, "/business-auth/register")
                }
                aria-disabled={disableCtas}
                className={`px-5 py-2 rounded-xl bg-white text-black font-semibold ${
                  disableCtas ? "opacity-60 cursor-not-allowed" : ""
                }`}
                data-business-cta="signup"
              >
                Sign Up
              </Link>
            </>
          )}

          {/* Logged IN — only dropdown */}
          {isBusinessAuthed && (
            <div className="flex items-center gap-4">
              <div className="relative" ref={notificationsRef}>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((open) => !open)}
                  className="relative rounded-2xl bg-white/5 px-3 py-2 border border-white/10 hover:border-white/30 transition text-white/90"
                  aria-label="Open notifications"
                >
                  <Bell className="h-5 w-5" />
                  {notificationUnreadCount > 0 ? (
                    <span className="absolute -top-1.5 -right-1.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold text-black">
                      {notificationUnreadCount}
                    </span>
                  ) : null}
                </button>

                {notificationsOpen ? (
                  <div className="absolute right-0 mt-4 w-80 rounded-3xl border border-white/15 bg-[#0d041c]/95 px-1.5 pb-3 pt-1.5 shadow-2xl shadow-purple-950/30 backdrop-blur-2xl">
                    <div className="rounded-[26px] bg-gradient-to-br from-white/8 via-white/5 to-white/0">
                      <div className="px-4 py-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">Notifications</p>
                          <p className="text-xs text-white/60">Order updates & alerts</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {notificationUnreadCount > 0 ? (
                            <button
                              type="button"
                              onClick={async () => {
                                const ids = notifications
                                  .filter((item) => !item.read_at)
                                  .map((item) => item.id);
                                if (!supabase || !user?.id || ids.length === 0) return;
                                await supabase
                                  .from("notifications")
                                  .update({ read_at: new Date().toISOString() })
                                  .in("id", ids)
                                  .eq("recipient_user_id", user.id);
                                loadNotificationCount();
                                loadNotifications();
                              }}
                              className="text-[11px] text-white/70 hover:text-white"
                            >
                              Mark all read
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={async () => {
                              if (!supabase || !user?.id || notifications.length === 0) return;
                              await supabase
                                .from("notifications")
                                .delete()
                                .eq("recipient_user_id", user.id);
                              setNotifications([]);
                              setNotificationUnreadCount(0);
                            }}
                            className="text-[11px] text-white/70 hover:text-white"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="px-2 pb-2 space-y-2">
                        {notificationsLoading ? (
                          <div className="rounded-2xl px-4 py-4 text-xs text-white/70">
                            Loading notifications...
                          </div>
                        ) : notifications.length === 0 ? (
                          <div className="rounded-2xl px-4 py-4 text-xs text-white/70">
                            No notifications yet.
                          </div>
                        ) : (
                          notifications.map((notification) => (
                            <button
                              key={notification.id}
                              type="button"
                              onClick={async () => {
                                if (!notification.read_at) {
                                  await markNotificationRead(notification.id);
                                }
                                setNotificationsOpen(false);
                                router.push("/business/orders");
                              }}
                              className={`w-full text-left rounded-2xl px-4 py-3 transition border ${
                                notification.read_at
                                  ? "border-white/10 bg-white/5"
                                  : "border-white/20 bg-white/10"
                              }`}
                            >
                              <p className="text-sm font-semibold text-white/90">
                                {notification.title}
                              </p>
                              {notification.body ? (
                                <p className="text-xs text-white/60 mt-1">
                                  {notification.body}
                                </p>
                              ) : null}
                              <p className="text-[11px] text-white/50 mt-2">
                                {new Date(notification.created_at).toLocaleString("en-US", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setProfileMenuOpen((open) => !open)}
                  className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-1.5 backdrop-blur-sm border border-white/10 hover:border-white/30 transition"
                >
                  <SafeImage
                    src={avatar}
                    alt="Avatar"
                    className="h-10 w-10 rounded-2xl object-cover border border-white/20"
                    width={40}
                    height={40}
                    sizes="40px"
                    useNextImage
                    priority
                  />
                  <span className="hidden sm:block text-sm font-semibold text-white/90 max-w-[140px] truncate">
                    {displayName}
                  </span>
                  <ChevronDown className="h-4 w-4 text-white/70" />
                </button>

                {profileMenuOpen && (
                  <div className="absolute right-0 mt-4 w-80 rounded-3xl border border-white/15 bg-[#0d041c]/95 px-1.5 pb-3 pt-1.5 shadow-2xl shadow-purple-950/30 backdrop-blur-2xl">
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
                          {email && (
                            <p className="text-xs text-white/60">{email}</p>
                          )}
                        </div>
                      </div>

                      <div className="px-2 pb-1 pt-2 space-y-1">
                        {quickActions.map(
                          ({ href, title, description, icon: Icon, showBadge }) => (
                            <Link
                              key={href}
                              href={href}
                              onClick={closeMenus}
                              className="flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-white/10"
                            >
                              <div className="h-11 w-11 rounded-2xl bg-white/10 flex items-center justify-center text-white">
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-semibold text-white/90">
                                    {title}
                                  </p>
                                  {showBadge && badgeReady && unreadCount > 0 ? (
                                    <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                                      {unreadCount}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-xs text-white/60">{description}</p>
                              </div>
                            </Link>
                          )
                        )}
                      </div>

                      <div className="mt-2 border-t border-white/10 px-4 pt-3">
                        <Link
                          href="/business/settings"
                          onClick={closeMenus}
                          className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                        >
                          <span className="flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            Account settings
                          </span>
                        </Link>
                        <LogoutButton
                          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-900/30 transition hover:opacity-90"
                          onSuccess={closeMenus}
                        >
                          <LogOut className="h-4 w-4" /> Logout
                        </LogoutButton>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

    <MobileSidebarDrawer
      open={mobileMenuOpen}
      onClose={() => setMobileMenuOpen(false)}
      title={isBusinessAuthed ? "Business menu" : "Welcome"}
      id={mobileDrawerId}
    >
      {isBusinessAuthed && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
          <SafeImage
            src={avatar}
            alt="Avatar"
            className="h-12 w-12 rounded-2xl object-cover border border-white/20"
            width={48}
            height={48}
            sizes="48px"
            useNextImage
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {displayName}
            </p>
            {email && <p className="text-xs text-white/60 truncate">{email}</p>}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 text-white">
        {!isBusinessAuthed && (
          <>
            <NavItem
              href="/business"
              isActive={isActive}
              closeMenus={closeMenus}
            >
              Businesses
            </NavItem>
            <NavItem
              href="/business/about"
              isActive={isActive}
              closeMenus={closeMenus}
            >
              About
            </NavItem>
          </>
        )}

        {isBusinessAuthed && (
          <>
            <NavItem
              href="/business/dashboard"
              isActive={isActive}
              closeMenus={closeMenus}
            >
              Open dashboard
            </NavItem>
            <NavItem
              href="/business/profile"
              isActive={isActive}
              closeMenus={closeMenus}
            >
              Business Profile
            </NavItem>
            <NavItem
              href="/business/listings"
              isActive={isActive}
              closeMenus={closeMenus}
            >
              Manage listings
            </NavItem>
            <NavItem
              href="/business/messages"
              isActive={isActive}
              closeMenus={closeMenus}
              badgeCount={unreadCount}
            >
              Messages
            </NavItem>
            <NavItem
              href="/business/orders"
              isActive={isActive}
              closeMenus={closeMenus}
            >
              Orders
            </NavItem>
          </>
        )}

        {!isBusinessAuthed ? (
          <>
            <NavItem
              href="/business-auth/login"
              onClick={(e) =>
                handleBusinessAuthClick(e, "/business-auth/login")
              }
              isActive={isActive}
              closeMenus={closeMenus}
              disabled={disableCtas}
              data-business-cta="login"
            >
              Login
            </NavItem>
            <Link
              href="/business-auth/register"
              onClick={(e) =>
                handleBusinessAuthClick(e, "/business-auth/register")
              }
              aria-disabled={disableCtas}
              className={`px-4 py-2 bg-white text-black rounded-lg text-center font-semibold ${
                disableCtas ? "opacity-60 cursor-not-allowed" : ""
              }`}
              data-business-cta="signup"
            >
              Sign Up
            </Link>
          </>
        ) : (
          <>
            <NavItem
              href="/business/settings"
              isActive={isActive}
              closeMenus={closeMenus}
            >
              Settings
            </NavItem>
            <LogoutButton mobile onSuccess={() => setMobileMenuOpen(false)} />
          </>
        )}
      </div>
    </MobileSidebarDrawer>
  </nav>
  );
}

export default function BusinessNavbar() {
  const pathname = usePathname();
  return <BusinessNavbarInner key={pathname} pathname={pathname} />;
}
