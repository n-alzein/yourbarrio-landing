"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "../ThemeToggle";
import { useModal } from "../modals/ModalProvider";

export default function CustomerNavbar() {
  const pathname = usePathname();
  const { user, role, loadingUser } = useAuth();
  const { openModal } = useModal();

  const [menuOpen, setMenuOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // ⭐ Hydration guard fixes frozen buttons
  useEffect(() => {
    setHydrated(true);
  }, []);

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
  const googleAvatar = user?.authUser?.user_metadata?.avatar_url || null;

  const avatar =
    user?.profile_photo_url?.trim() ||
    googleAvatar ||
    "/customer-placeholder.png";

  const displayName =
    user?.full_name ||
    user?.authUser?.user_metadata?.full_name ||
    user?.authUser?.user_metadata?.name ||
    "Account";

  const isActive = (href) => pathname === href;

  const NavItem = ({ href, children }) => (
    <Link
      href={href}
      className={`text-sm md:text-base transition ${
        isActive(href)
          ? "text-white font-semibold"
          : "text-white/70 hover:text-white"
      }`}
      onClick={() => setMenuOpen(false)}
    >
      {children}
    </Link>
  );

  /* ---------------------------------------------------
     LOADING STATE
  --------------------------------------------------- */
  if (loadingUser) {
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
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-3"
              >
                <img
                  src={avatar}
                  className="h-10 w-10 rounded-xl object-cover border border-white/20"
                />
                <span className="hidden sm:block text-sm font-semibold text-white/90 max-w-[120px] truncate">
                  {displayName}
                </span>
                <ChevronDown className="h-4 w-4 text-white/70" />
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 mt-3 w-48 py-2 rounded-xl bg-gradient-to-br from-purple-950/80 via-purple-900/70 to-fuchsia-900/70 backdrop-blur-xl border border-white/20 shadow-xl z-50"
                >
                  <Link
                    href="/customer/settings"
                    className="flex items-center gap-2 px-4 py-2 hover:bg-white/10 text-white/90"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>

                  {/* ⭐ FIXED: no stopPropagation, no wrapper div */}
                  <LogoutButton
                    className="flex w-full items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/10 text-white/90"
                    onSuccess={() => setMenuOpen(false)}
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </LogoutButton>
                </div>
              )}
            </div>
          )}
        </div>

        {/* MOBILE MENU BUTTON */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden text-white"
        >
          {menuOpen ? (
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
      {menuOpen && (
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
                  setMenuOpen(false);
                  openModal("customer-login");
                }}
                className="text-left text-white/70 hover:text-white"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
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
