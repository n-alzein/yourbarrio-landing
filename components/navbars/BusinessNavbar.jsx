"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { openBusinessAuthPopup } from "@/lib/openBusinessAuthPopup";
import { fetchUnreadTotal } from "@/lib/messages";
import { resolveImageSrc } from "@/lib/safeImage";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient";

function NavItem({ href, children, onClick, isActive, closeMenus, badgeCount }) {
  return (
    <Link
      href={href}
      onClick={(e) => {
        onClick?.(e);
        closeMenus?.();
      }}
      className={`text-sm md:text-base transition ${
        isActive?.(href)
          ? "text-white font-semibold"
          : "text-white/70 hover:text-white"
      }`}
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

export default function BusinessNavbar({ requireAuth = false }) {
  const pathname = usePathname();
  const { user, authUser, role, loadingUser, supabase } = useAuth();

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [badgeReady, setBadgeReady] = useState(false);
  const dropdownRef = useRef(null);
  const displayName =
    user?.business_name ||
    user?.full_name ||
    authUser?.user_metadata?.full_name ||
    authUser?.user_metadata?.name ||
    "Account";

  useEffect(() => {
    setProfileMenuOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!loadingUser) setBadgeReady(true);
  }, [loadingUser]);

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
    photoUrl?.trim() || "",
    "/business-placeholder.png"
  );

  const isActive = (href) => pathname === href;
  const email =
    user?.email ||
    authUser?.email ||
    authUser?.user_metadata?.email ||
    null;

  const handleBusinessAuthClick = (event, path) => {
    event.preventDefault();
    openBusinessAuthPopup(path);
  };

  const closeMenus = () => {
    setProfileMenuOpen(false);
    setMobileMenuOpen(false);
  };

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
    const userId = user?.id || authUser?.id;
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
  }, [supabase, user?.id, authUser?.id, role]);

  useEffect(() => {
    if (!badgeReady) return;
    loadUnreadCount();
  }, [badgeReady, loadUnreadCount]);

  useEffect(() => {
    if (!badgeReady) return undefined;
    const userId = user?.id || authUser?.id;
    if (!userId || role !== "business") return undefined;
    const client = supabase ?? getBrowserSupabaseClient();
    if (!client) return undefined;

    const channel = client
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
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [badgeReady, user?.id, authUser?.id, supabase, role, loadUnreadCount]);

  const isBusinessAuthed = Boolean(authUser) && role === "business";
  const holdUntilAuthed = requireAuth && (!authUser || role !== "business");

  if (loadingUser || holdUntilAuthed) {
    return (
      <nav
        className="fixed top-0 inset-x-0 z-50 h-16 bg-gradient-to-r from-purple-950/80 via-purple-900/60 to-fuchsia-900/70 backdrop-blur-xl border-b border-white/10 theme-lock"
        data-business-navbar="1"
      />
    );
  }

  /* ---------------------------------------------------
     NAVBAR
  --------------------------------------------------- */
  return (
    <nav
      className="fixed top-0 inset-x-0 z-50 bg-gradient-to-r from-purple-950/80 via-purple-900/60 to-fuchsia-900/70 backdrop-blur-xl border-b border-white/10 theme-lock"
      data-business-navbar="1"
    >
      <div className="w-full px-5 sm:px-6 md:px-8 lg:px-10 xl:px-14 flex items-center justify-between h-20">

        {/* LEFT SIDE */}
        <div className="flex items-center gap-10">
          {/* Logo */}
          <div className="relative flex items-center">
            <Link href={user ? "/business/dashboard" : "/business"}>
              <img
                src="/logo.png"
                className="h-34 w-auto cursor-pointer"
                alt="YourBarrio"
              />
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
              >
                Login
              </NavItem>
              <Link
                href="/business-auth/register"
                onClick={(e) =>
                  handleBusinessAuthClick(e, "/business-auth/register")
                }
                className="px-5 py-2 rounded-xl bg-white text-black font-semibold"
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
                <img
                  src={avatar}
                  className="h-10 w-10 rounded-2xl object-cover border border-white/20"
                  alt="Avatar"
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
                      <img
                        src={avatar}
                        className="h-12 w-12 rounded-2xl object-cover border border-white/20 shadow-inner shadow-black/50"
                        alt="Profile avatar"
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

        {/* MOBILE MENU BUTTON */}
        <button
          onClick={() => setMobileMenuOpen((open) => !open)}
          className="md:hidden text-white"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? (
            <svg className="h-7 w-7" fill="none" stroke="currentColor">
              <path strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-7 w-7" fill="none" stroke="currentColor">
              <path strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

    {/* MOBILE MENU */}
    {mobileMenuOpen && (
      <div className="md:hidden bg-gradient-to-r from-purple-950/80 via-purple-900/60 to-fuchsia-900/70 backdrop-blur-xl border-t border-white/10 px-6 py-5 flex flex-col gap-6 text-white">
        {isBusinessAuthed && (
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
            <img
              src={avatar}
              className="h-12 w-12 rounded-2xl object-cover border border-white/20"
              alt="Avatar"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {displayName}
              </p>
              {email && (
                <p className="text-xs text-white/60 truncate">{email}</p>
              )}
            </div>
          </div>
        )}

        <ThemeToggle
          showLabel
          align="left"
          className="self-start"
          buttonClassName="px-2.5 py-1.5 text-[11px] font-medium text-white/70 border-white/10 bg-white/5 hover:bg-white/10"
        />

        {/* Logged-out */}
        {!isBusinessAuthed && (
          <NavItem
            href="/business"
            isActive={isActive}
            closeMenus={closeMenus}
          >
            Businesses
          </NavItem>
        )}
        {!isBusinessAuthed && (
          <NavItem
            href="/business/about"
            isActive={isActive}
            closeMenus={closeMenus}
          >
            About
          </NavItem>
        )}

        {/* Logged-in business menu */}
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
            >
              Login
            </NavItem>
            <Link
              href="/business-auth/register"
              onClick={(e) =>
                handleBusinessAuthClick(e, "/business-auth/register")
              }
              className="px-4 py-2 bg-white text-black rounded-lg text-center font-semibold"
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
    )}
  </nav>
  );
}
