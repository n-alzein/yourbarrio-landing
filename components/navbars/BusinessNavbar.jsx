"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Building2,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  Store,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "../ThemeToggle";
import MobileSidebarDrawer from "@/components/nav/MobileSidebarDrawer";
import { openBusinessAuthPopup } from "@/lib/openBusinessAuthPopup";
import { fetchUnreadTotal } from "@/lib/messages";
import { resolveImageSrc } from "@/lib/safeImage";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient";
import SafeImage from "@/components/SafeImage";
import { subscribeIfSession } from "@/lib/realtime/subscribeIfSession";

function NavItem({
  href,
  children,
  onClick,
  isActive,
  closeMenus,
  badgeCount,
  disabled = false,
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
  const { user, profile, role, loadingUser, supabase, authStatus } = useAuth();

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const mobileDrawerId = useId();
  const dropdownRef = useRef(null);
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

  const loadUnreadCount = useCallback(async () => {
    const userId = user?.id;
    if (!userId || role !== "business") return;
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
  }, [supabase, user?.id, role]);

  useEffect(() => {
    if (!badgeReady) return;
    queueMicrotask(() => {
      loadUnreadCount();
    });
  }, [badgeReady, loadUnreadCount]);

  useEffect(() => {
    if (!badgeReady) return undefined;
    if (authStatus !== "authenticated") return undefined;
    const userId = user?.id;
    if (!userId || role !== "business") return undefined;
    let cancelled = false;
    let channel = null;
    let client = null;

    (async () => {
      client = supabase ?? getBrowserSupabaseClient();
      if (!client) return;
      channel = await subscribeIfSession(
        client,
        (activeClient) =>
          activeClient
            .channel(`business-unread-${userId}`)
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "conversations",
                filter: `business_id=eq.${userId}`,
              },
              () => {
                loadUnreadCount();
              }
            ),
        "business-unread"
      );
      if (cancelled && channel && client) {
        client.removeChannel(channel);
      }
    })();

    return () => {
      cancelled = true;
      if (channel && client) {
        client.removeChannel(channel);
      }
    };
  }, [authStatus, badgeReady, user?.id, supabase, role, loadUnreadCount]);

  const isBusinessAuthed = Boolean(user) && role === "business";
  const disableCtas = loadingUser && !user;

  /* ---------------------------------------------------
     NAVBAR
  --------------------------------------------------- */
  return (
    <nav
      className="fixed top-0 inset-x-0 z-50 bg-gradient-to-r from-purple-950/80 via-purple-900/60 to-fuchsia-900/70 backdrop-blur-xl border-b border-white/10 theme-lock"
      data-business-navbar="1"
    >
      <div className="w-full px-5 sm:px-6 md:px-8 lg:px-10 xl:px-14 flex items-center justify-between h-20">
        {/* MOBILE MENU BUTTON */}
        <button
          onClick={() => {
            setProfileMenuOpen(false);
            setMobileMenuOpen((open) => !open);
          }}
          className="md:hidden text-white mr-3"
          aria-label="Open menu"
          aria-expanded={mobileMenuOpen}
          aria-controls={mobileDrawerId}
        >
          <svg className="h-7 w-7" fill="none" stroke="currentColor">
            <path strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* LEFT SIDE */}
        <div className="flex items-center gap-10">
          {/* Logo */}
          <div className="relative flex items-center">
            <Link href={user ? "/business/dashboard" : "/business"}>
              <span className="relative block h-10 w-10">
                <Image
                  src="/logo.png"
                  alt="YourBarrio"
                  fill
                  sizes="40px"
                  priority
                  className="object-contain"
                />
              </span>
            </Link>

            <span
              className="absolute text-xs font-semibold text-white/80 whitespace-nowrap"
              style={{ left: "75px", bottom: "36px" }}
            >
              for Business
            </span>
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
              >
                Sign Up
              </Link>
            </>
          )}

          {/* Logged IN — only dropdown */}
          {isBusinessAuthed && (
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
                      <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                        <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                          Theme
                        </span>
                        <ThemeToggle
                          buttonClassName="px-2.5 py-1.5 text-[11px] font-medium text-white/70 border-white/10 bg-white/5 hover:bg-white/10"
                        />
                      </div>
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
          )}
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

      <ThemeToggle
        showLabel
        align="left"
        className="mb-5 self-start"
        buttonClassName="px-2.5 py-1.5 text-[11px] font-medium text-white/70 border-white/10 bg-white/5 hover:bg-white/10"
      />

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
