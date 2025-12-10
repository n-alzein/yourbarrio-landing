"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  Bookmark,
  Building2,
  ChevronDown,
  Compass,
  LogOut,
  Settings,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "../ThemeToggle";
import { useModal } from "../modals/ModalProvider";

export default function CustomerNavbar() {
  const pathname = usePathname();
  const { user, authUser, loadingUser } = useAuth();
  const { openModal } = useModal();

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hydrated, setHydrated] = useState(typeof window !== "undefined");
  const dropdownRef = useRef(null);

  // ⭐ Hydration guard fixes frozen buttons
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Close menus when the route changes
  useEffect(() => {
    setProfileMenuOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close dropdown on outside click for a more premium, lightweight feel
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

  if (!hydrated) return null;

  /* ---------------------------------------------------
     ⛔ DO NOT RENDER CUSTOMER NAV ON BUSINESS PAGES
  --------------------------------------------------- */
  if (
    pathname.startsWith("/business") ||
    pathname.startsWith("/business-auth")
  ) {
    return null;
  }

  /* ---------------------------------------------------
     AVATAR PRIORITY
  --------------------------------------------------- */
  const googleAvatar = authUser?.user_metadata?.avatar_url || null;

  const avatar =
    user?.profile_photo_url?.trim() ||
    googleAvatar ||
    "/customer-placeholder.png";

  const displayName =
    user?.full_name ||
    user?.authUser?.user_metadata?.full_name ||
    user?.authUser?.user_metadata?.name ||
    "Account";

  const email =
    user?.email ||
    user?.authUser?.email ||
    user?.authUser?.user_metadata?.email ||
    null;

  const isActive = (href) => pathname === href;

  const closeMenus = () => {
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
  };

  const NavItem = ({ href, children }) => (
    <Link
      href={href}
      className={`text-sm md:text-base transition ${
        isActive(href)
          ? "text-white font-semibold"
          : "text-white/70 hover:text-white"
      }`}
      onClick={closeMenus}
    >
      {children}
    </Link>
  );

  const quickActions = [
    {
      href: "/customer/home",
      title: "Discover",
      description: "See what's buzzing near you",
      icon: Compass,
    },
    {
      href: "/customer/businesses",
      title: "Find businesses",
      description: "Curated shops in your barrio",
      icon: Building2,
    },
    {
      href: "/customer/saved",
      title: "Saved spots",
      description: "Instant access to your favorites",
      icon: Bookmark,
    },
  ];

  /* ---------------------------------------------------
     LOADING STATE
  --------------------------------------------------- */
  if (loadingUser && !user && !authUser) {
    return (
      <nav className="fixed top-0 inset-x-0 z-50 h-16 bg-gradient-to-r from-purple-950/80 via-purple-900/60 to-fuchsia-900/70 backdrop-blur-xl border-b border-white/10 theme-lock" />
    );
  }

  /* ---------------------------------------------------
     NAVBAR UI
  --------------------------------------------------- */
  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-gradient-to-r from-purple-950/80 via-purple-900/60 to-fuchsia-900/70 backdrop-blur-xl border-b border-white/10 theme-lock">
      <div className="max-w-7xl mx-auto px-8 flex items-center justify-between h-20">

        {/* LEFT GROUP — LOGO + NAV LINKS */}
        <div className="flex items-center gap-10">
          <Link href="/customer/home">
            <img
              src="/logo.png"
              className="h-34 w-auto cursor-pointer select-none"
              alt="YourBarrio"
            />
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <NavItem href="/customer/home">Home</NavItem>
            <NavItem href="/customer/businesses">Businesses</NavItem>
            <NavItem href="/customer/saved">Saved</NavItem>
            <NavItem href="/customer/about">About</NavItem>
          </div>
        </div>

        {/* RIGHT — AUTH STATE */}
        <div className="hidden md:flex items-center gap-8">
          <ThemeToggle />

          {!user && (
            <>
              <button
                type="button"
                onClick={() => openModal("customer-login")}
                className="text-sm md:text-base transition text-white/70 hover:text-white"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => openModal("customer-signup")}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 text-white font-semibold"
              >
                Sign Up
              </button>
            </>
          )}

          {user && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setProfileMenuOpen((open) => !open)}
                className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-1.5 backdrop-blur-sm border border-white/10 hover:border-white/30 transition"
              >
                <Image
                  src={avatar}
                  alt="Profile avatar"
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-2xl object-cover border border-white/20"
                />
                <span className="hidden sm:block text-sm font-semibold text-white/90 max-w-[120px] truncate">
                  {displayName}
                </span>
                <ChevronDown className="h-4 w-4 text-white/70" />
              </button>

              {profileMenuOpen && (
                <div
                  className="absolute right-0 mt-4 w-80 rounded-3xl border border-white/15 bg-[#0d041c]/95 px-1.5 pb-3 pt-1.5 shadow-2xl shadow-purple-950/30 backdrop-blur-2xl z-50"
                >
                  <div className="rounded-[26px] bg-gradient-to-br from-white/8 via-white/5 to-white/0">
                    <div className="flex items-center gap-3 px-4 py-4">
                      <Image
                        src={avatar}
                        alt="Profile avatar"
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded-2xl object-cover border border-white/20 shadow-inner shadow-black/50"
                      />
                      <div>
                        <p className="text-sm font-semibold text-white">{displayName}</p>
                        {email && (
                          <p className="text-xs text-white/60">{email}</p>
                        )}
                      </div>
                    </div>

                    <div className="px-2 pb-1 pt-2 space-y-1">
                      {quickActions.map(({ href, title, description, icon: Icon }) => (
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
                            <p className="text-sm font-semibold text-white/90">{title}</p>
                            <p className="text-xs text-white/60">{description}</p>
                          </div>
                        </Link>
                      ))}
                    </div>

                    <div className="mt-2 border-t border-white/10 px-4 pt-3">
                      <Link
                        href="/customer/settings"
                        onClick={closeMenus}
                        className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                      >
                        <span className="flex items-center gap-2">
                          <Settings className="h-4 w-4" />
                          Account settings
                        </span>
                        <span className="text-white/50 text-xs">⌘ ,</span>
                      </Link>
                      <LogoutButton
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-900/30 transition hover:opacity-90"
                        onSuccess={closeMenus}
                      >
                        <LogOut className="h-4 w-4" />
                        Logout
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
        <div className="md:hidden bg-gradient-to-r from-purple-950/80 via-purple-900/60 to-fuchsia-900/70 backdrop-blur-xl border-t border-white/10 px-6 py-5 flex flex-col gap-5 text-white">
          <NavItem href="/customer/home">Home</NavItem>
          <NavItem href="/customer/businesses">Businesses</NavItem>
          <NavItem href="/customer/saved">Saved</NavItem>
          <NavItem href="/customer/about">About</NavItem>
          <ThemeToggle showLabel align="left" />

          {!user && (
            <>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openModal("customer-login");
                }}
                className="text-left text-white/70 hover:text-white"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openModal("customer-signup");
                }}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 rounded-xl text-center font-semibold"
              >
                Sign Up
              </button>
            </>
          )}

          {user && (
            <>
              <NavItem href="/customer/settings">Settings</NavItem>

              <LogoutButton mobile />
            </>
          )}
        </div>
      )}
    </nav>
  );
}
