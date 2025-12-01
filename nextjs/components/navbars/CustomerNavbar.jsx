"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { ChevronDown, LogOut, Settings, User } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import LogoutButton from "@/components/LogoutButton";

export default function CustomerNavbar() {
  const pathname = usePathname();
  const { user, role, loadingUser, supabase } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);

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
     LOAD AVATAR
  --------------------------------------------------- */
  useEffect(() => {
    async function load() {
      if (!user) return setPhotoUrl(null);

      const { data } = await supabase
        .from("users")
        .select("profile_photo_url")
        .eq("id", user.id)
        .single();

      setPhotoUrl(data?.profile_photo_url ?? null);
    }

    load();
  }, [user, supabase]);

  const avatar = photoUrl?.trim()
    ? photoUrl
    : "/customer-placeholder.png";

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
      <nav className="fixed top-0 inset-x-0 z-50 h-16 bg-black/40 backdrop-blur-xl border-b border-white/10" />
    );
  }

  /* ---------------------------------------------------
     NAVBAR UI
  --------------------------------------------------- */
  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-black/40 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-8 flex items-center justify-between h-20">
        
        {/* LEFT — LOGO */}
        <Link href="/customer/home">
          <img
            src="/logo.png"
            className="h-34 w-auto cursor-pointer select-none"
            alt="YourBarrio"
          />
        </Link>

        {/* CENTER — LINKS */}
        <div className="hidden md:flex items-center gap-10">
          <NavItem href="/customer/home">Home</NavItem>
          <NavItem href="/businesses">Businesses</NavItem>
          <NavItem href="/customer/saved">Saved</NavItem>
          <NavItem href="/about">About</NavItem>
        </div>

        {/* RIGHT — AUTH STATE */}
        <div className="hidden md:flex items-center gap-8">

          {!user && (
            <>
              <NavItem href="/auth/login">Login</NavItem>
              <Link
                href="/auth/register"
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 text-white font-semibold"
              >
                Sign Up
              </Link>
            </>
          )}

          {user && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2"
              >
                <img
                  src={avatar}
                  className="h-10 w-10 rounded-xl object-cover border border-white/20"
                />
                <ChevronDown className="h-4 w-4 text-white/70" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-3 w-48 py-2 rounded-xl bg-black/40 backdrop-blur-xl border border-white/20 shadow-xl">
                  <Link
                    href="/customer/profile"
                    className="flex items-center gap-2 px-4 py-2 hover:bg-white/10 text-white/90"
                    onClick={() => setMenuOpen(false)}
                  >
                    <User className="h-4 w-4" />
                    Profile
                  </Link>

                  <Link
                    href="/customer/settings"
                    className="flex items-center gap-2 px-4 py-2 hover:bg-white/10 text-white/90"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>

                  <div className="px-2 mt-1">
                    <LogoutButton className="flex w-full items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/10 text-white/90">
                      <LogOut className="h-4 w-4" /> Logout
                    </LogoutButton>
                  </div>
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
        <div className="md:hidden bg-black/50 backdrop-blur-xl border-t border-white/10 px-6 py-5 flex flex-col gap-5 text-white">

          <NavItem href="/customer/home">Home</NavItem>
          <NavItem href="/businesses">Businesses</NavItem>
          <NavItem href="/customer/saved">Saved</NavItem>
          <NavItem href="/about">About</NavItem>

          {!user && (
            <>
              <NavItem href="/auth/login">Login</NavItem>
              <Link
                href="/auth/register"
                className="px-4 py-2 bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 rounded-xl text-center font-semibold"
              >
                Sign Up
              </Link>
            </>
          )}

          {user && (
            <>
              <NavItem href="/customer/profile">Profile</NavItem>
              <NavItem href="/customer/settings">Settings</NavItem>

              <LogoutButton mobile />
            </>
          )}
        </div>
      )}
    </nav>
  );
}
