"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Settings,
  Store,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "../ThemeToggle";
import { openBusinessAuthPopup } from "@/lib/openBusinessAuthPopup";

export default function BusinessNavbar() {
  const pathname = usePathname();
  const { user, authUser, role, loadingUser, supabase } = useAuth();

  const [hydrated, setHydrated] = useState(typeof window !== "undefined");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const dropdownRef = useRef(null);
  const displayName =
    user?.business_name ||
    user?.full_name ||
    authUser?.user_metadata?.full_name ||
    authUser?.user_metadata?.name ||
    "Account";

  // Hydration guard prevents frozen dropdown interactions
  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    setProfileMenuOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

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
      if (!user) return setPhotoUrl(null);

      const { data } = await supabase
        .from("users")
        .select("profile_photo_url")
        .eq("id", user.id)
        .single();

      setPhotoUrl(data?.profile_photo_url ?? null);
    }
    loadPhoto();
  }, [user, supabase]);

  const avatar = photoUrl?.trim()
    ? photoUrl
    : "/business-placeholder.png";

  const isActive = (href) => pathname === href;
  const email =
    user?.email ||
    authUser?.email ||
    authUser?.user_metadata?.email ||
    null;

  if (!hydrated) return null;

  if (loadingUser && !user && !authUser) {
    return (
      <nav className="fixed top-0 inset-x-0 z-50 h-16 bg-gradient-to-r from-purple-950/80 via-purple-900/60 to-fuchsia-900/70 backdrop-blur-xl border-b border-white/10 theme-lock" />
    );
  }

  const handleBusinessAuthClick = (event, path) => {
    event.preventDefault();
    openBusinessAuthPopup(path);
  };

  const closeMenus = () => {
    setProfileMenuOpen(false);
    setMobileMenuOpen(false);
  };

  const NavItem = ({ href, children, onClick }) => (
    <Link
      href={href}
      onClick={(e) => {
        onClick?.(e);
        closeMenus();
      }}
      className={`text-sm md:text-base transition ${
        isActive(href)
          ? "text-white font-semibold"
          : "text-white/70 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );

  const quickActions = [
    {
      href: "/business/dashboard",
      title: "Open dashboard",
      description: "Monitor performance & leads",
      icon: LayoutDashboard,
    },
    {
      href: "/business/listings",
      title: "Manage listings",
      description: "Keep offers & hours fresh",
      icon: Store,
    },
    {
      href: "/business/settings",
      title: "Business settings",
      description: "Team access, billing & more",
      icon: Settings,
    },
  ];

  /* ---------------------------------------------------
     NAVBAR
  --------------------------------------------------- */
  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-gradient-to-r from-purple-950/80 via-purple-900/60 to-fuchsia-900/70 backdrop-blur-xl border-b border-white/10 theme-lock">
      <div className="max-w-7xl mx-auto px-8 flex items-center justify-between h-20">

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
            {!user && <NavItem href="/business">Businesses</NavItem>}

            {/* Logged-in business nav (LEFT SIDE) */}
            {user && role === "business" && null}

            {/* Logged-out → show About */}
            {!user && <NavItem href="/business/about">About</NavItem>}
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="hidden md:flex items-center gap-8">
          <ThemeToggle />

          {/* Logged OUT */}
          {!user && (
            <>
              <NavItem
                href="/business-auth/login"
                onClick={(e) =>
                  handleBusinessAuthClick(e, "/business-auth/login")
                }
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
          {user && role === "business" && (
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
                        ({ href, title, description, icon: Icon }) => (
                          <Link
                            key={href}
                            href={href}
                            onClick={closeMenus}
                            className="flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-white/10"
                          >
                            <div className="h-11 w-11 rounded-2xl bg-white/10 flex items-center justify-center text-white">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-white/90">
                                {title}
                              </p>
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
          )}
        </div>
      </div>

      {/* MOBILE MENU BUTTON */}
      <button
        onClick={() => setMobileMenuOpen((open) => !open)}
        className="md:hidden text-white"
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

    {/* MOBILE MENU */}
    {mobileMenuOpen && (
      <div className="md:hidden bg-gradient-to-r from-purple-950/80 via-purple-900/60 to-fuchsia-900/70 backdrop-blur-xl border-t border-white/10 px-6 py-5 flex flex-col gap-6 text-white">
        <ThemeToggle showLabel align="left" />

        {/* Logged-out */}
        {!user && <NavItem href="/business">Businesses</NavItem>}
        {!user && <NavItem href="/business/about">About</NavItem>}

        {/* Logged-in business menu */}
        {user && role === "business" && (
          <>
            <NavItem href="/business/dashboard">Dashboard</NavItem>
            <NavItem href="/business/listings">Listings</NavItem>
            <NavItem href="/business/about">About</NavItem>
          </>
        )}

        {!user ? (
          <>
            <NavItem
              href="/business-auth/login"
              onClick={(e) =>
                handleBusinessAuthClick(e, "/business-auth/login")
              }
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
            <NavItem href="/business/settings">Settings</NavItem>
            <LogoutButton mobile onSuccess={() => setMobileMenuOpen(false)} />
          </>
        )}
      </div>
    )}
  </nav>
  );
}
