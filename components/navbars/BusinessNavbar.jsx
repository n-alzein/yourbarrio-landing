"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Settings,
  User,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import LogoutButton from "@/components/LogoutButton";

export default function BusinessNavbar() {
  const pathname = usePathname();
  const { user, role, loadingUser, supabase } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);

  if (loadingUser) return null;

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

  const NavItem = ({ href, children }) => (
    <Link
      href={href}
      onClick={() => setMenuOpen(false)}
      className={`text-sm md:text-base transition ${
        isActive(href)
          ? "text-white font-semibold"
          : "text-white/70 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );

  /* ---------------------------------------------------
     NAVBAR
  --------------------------------------------------- */
  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-black/40 backdrop-blur-xl border-b border-white/10">
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
            {user && role === "business" && (
              <>
                <NavItem href="/business/dashboard">Dashboard</NavItem>
                <NavItem href="/business/listings">Listings</NavItem>
                <NavItem href="/business/about">About</NavItem>
              </>
            )}

            {/* Logged-out → show About */}
            {!user && <NavItem href="/business/about">About</NavItem>}
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="hidden md:flex items-center gap-8">

          {/* ❌ REMOVE Listings + Dashboard here — now only profile & logout */}

          {/* Logged OUT */}
          {!user && (
            <>
              <NavItem href="/business-auth/login">Login</NavItem>
              <Link
                href="/business-auth/register"
                className="px-5 py-2 rounded-xl bg-white text-black font-semibold"
              >
                Sign Up
              </Link>
            </>
          )}

          {/* Logged IN — only dropdown */}
          {user && role === "business" && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2"
              >
                <img
                  src={avatar}
                  className="h-10 w-10 rounded-xl object-cover border border-white/20"
                  alt="Avatar"
                />
                <ChevronDown className="h-4 w-4 text-white/70" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-3 w-48 py-2 rounded-xl bg-black/40 backdrop-blur-xl border border-white/20 shadow-xl">
                  
                  <Link
                    href="/business/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-white/10 text-white/90"
                  >
                    <User className="h-4 w-4" /> Profile
                  </Link>

                  <Link
                    href="/business/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-white/10 text-white/90"
                  >
                    <Settings className="h-4 w-4" /> Settings
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
        <div className="md:hidden bg-black/60 backdrop-blur-xl border-t border-white/10 px-6 py-5 flex flex-col gap-6 text-white">

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
              <NavItem href="/business-auth/login">Login</NavItem>
              <Link
                href="/business-auth/register"
                className="px-4 py-2 bg-white text-black rounded-lg text-center font-semibold"
              >
                Sign Up
              </Link>
            </>
          ) : (
            <>
              <NavItem href="/business/profile">Profile</NavItem>
              <NavItem href="/business/settings">Settings</NavItem>
              <LogoutButton mobile />
            </>
          )}
        </div>
      )}
    </nav>
  );
}
