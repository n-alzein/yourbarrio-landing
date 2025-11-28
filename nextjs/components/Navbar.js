"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import LogoutButton from "./LogoutButton";
import { createBrowserClient } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import { ChevronDown, User, LogOut, LayoutDashboard } from "lucide-react";

export default function Navbar() {
  const supabase = createBrowserClient();
  const { user, role, loadingUser } = useAuth();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);

  const isActive = (href) => pathname === href;

  const NavItem = ({ href, children }) => (
    <div className="flex items-center">
      <Link
        href={href}
        onClick={() => {
          setOpen(false);
          setMenuOpen(false);
        }}
        className={`relative text-sm md:text-base font-medium transition-all duration-300 ${
          isActive(href) ? "text-white" : "text-white/70 hover:text-white"
        }`}
      >
        {children}
        <span
          className={`absolute left-0 -bottom-1 h-[2px] w-full bg-gradient-to-r from-purple-400 to-pink-400 rounded-full transition-all ${
            isActive(href) ? "opacity-100 scale-100" : "opacity-0 scale-50"
          }`}
        />
      </Link>
    </div>
  );

  // Load customer or business profile photo
  useEffect(() => {
    let isMounted = true;

    async function loadPhoto() {
      if (!user) {
        if (isMounted) setPhotoUrl(null);
        return;
      }

      try {
        let query;
        if (role === "business") {
          query = supabase
            .from("business_profiles")
            .select("profile_photo_url")
            .eq("owner_id", user.id)
            .single();
        } else {
          query = supabase
            .from("profiles")
            .select("profile_photo_url")
            .eq("id", user.id)
            .single();
        }

        const { data, error } = await query;

        if (error) {
          console.error("Navbar avatar fetch error:", error);
          if (isMounted) setPhotoUrl(null);
          return;
        }

        if (isMounted) {
          setPhotoUrl(data?.profile_photo_url ?? null);
        }
      } catch (err) {
        console.error("Navbar avatar unexpected error:", err);
        if (isMounted) setPhotoUrl(null);
      }
    }

    loadPhoto();

    return () => {
      isMounted = false;
    };
  }, [user?.id, role, supabase]);

  const avatarSrc =
    photoUrl && typeof photoUrl === "string" && photoUrl.trim() !== ""
      ? photoUrl
      : "/business-placeholder.png";

  const dashboardLink =
    role === "business" ? "/business/dashboard" : "/dashboard";

  // While auth state is loading, show a simple bar (prevents flicker / mismatch)
  if (loadingUser) {
    return (
      <nav className="fixed top-0 inset-x-0 z-50 h-16 backdrop-blur-2xl bg-white/10 border-b border-white/20" />
    );
  }

  return (
    <nav className="fixed top-0 inset-x-0 z-50">
      <div className="backdrop-blur-2xl bg-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.25)] border-b border-white/20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="h-16 flex items-center justify-between">
            {/* LEFT SECTION — LOGO + NAV LINKS */}
            <div className="flex items-center gap-x-10">
              <Link href="/" className="flex items-center select-none">
                <img
                  src="/logo.png"
                  alt="YourBarrio Logo"
                  className="h-40 w-auto drop-shadow-[0_4px_12px_rgba(0,0,0,0.35)]"
                  draggable="false"
                />
              </Link>

              <div className="hidden md:flex items-center gap-x-8">
                <NavItem href="/businesses">Businesses</NavItem>
                <NavItem href="/about">About</NavItem>
              </div>
            </div>

            {/* RIGHT SECTION — AUTH OR DROPDOWN */}
            <div className="hidden md:flex items-center gap-x-12">
              {!user ? (
                <>
                  <NavItem href="/login">Log in</NavItem>
                  <Link
                    href="/register"
                    className="px-5 py-2 rounded-xl font-semibold text-white whitespace-nowrap bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 shadow-[0_4px_20px_rgba(255,0,128,0.35)] hover:brightness-110 active:scale-95 transition-all"
                  >
                    Sign Up
                  </Link>
                </>
              ) : (
                <>
                  {/* PROFILE DROPDOWN */}
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen(!menuOpen)}
                      className="flex items-center gap-2 group"
                      type="button"
                    >
                      <img
                        src={avatarSrc}
                        className="h-10 w-10 rounded-xl object-cover border border-white/20 shadow-lg group-hover:ring-2 group-hover:ring-white/40 transition"
                        alt="Profile"
                      />
                      <ChevronDown className="h-4 w-4 text-white/80 group-hover:text-white transition" />
                    </button>

                    {menuOpen && (
                      <div className="absolute right-0 mt-3 w-48 py-2 rounded-xl shadow-xl border border-white/20 backdrop-blur-2xl bg-white/10">
                        <Link
                          href={
                            role === "business"
                              ? "/business/profile"
                              : "/profile"
                          }
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-white/90 hover:bg-white/10 transition"
                        >
                          <User className="h-4 w-4" />
                          Profile
                        </Link>

                        <Link
                          href={dashboardLink}
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-white/90 hover:bg-white/10 transition"
                        >
                          <LayoutDashboard className="h-4 w-4" />
                          Dashboard
                        </Link>

                        <div className="px-2 mt-1">
                          <LogoutButton className="w-full flex items-center gap-2 px-4 py-2 text-left text-white/90 hover:bg-white/10 rounded-lg transition">
                            <LogOut className="h-4 w-4" />
                            Logout
                          </LogoutButton>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* MOBILE MENU BUTTON */}
            <button
              className="md:hidden text-white hover:text-white/90 transition"
              onClick={() => setOpen(!open)}
              type="button"
            >
              {open ? (
                <svg
                  className="h-7 w-7"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="h-7 w-7"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE MENU */}
      {open && (
        <div className="md:hidden backdrop-blur-2xl bg-black/30 border-b border-white/20 shadow-xl transition-all">
          <div className="px-6 py-4 flex flex-col gap-5 text-white">
            <NavItem href="/businesses">Businesses</NavItem>
            <NavItem href="/about">About</NavItem>

            {!user ? (
              <>
                <NavItem href="/login">Login</NavItem>

                <Link
                  href="/register"
                  className="px-4 py-2 rounded-lg text-center font-semibold bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 shadow-md"
                  onClick={() => setOpen(false)}
                >
                  Sign Up
                </Link>
              </>
            ) : (
              <>
                <NavItem
                  href={
                    role === "business"
                      ? "/business/profile"
                      : "/profile"
                  }
                >
                  Profile
                </NavItem>

                <NavItem href={dashboardLink}>Dashboard</NavItem>

                <LogoutButton mobile />
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
