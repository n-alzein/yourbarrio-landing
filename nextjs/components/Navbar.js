"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import LogoutButton from "./LogoutButton";

export default function Navbar({ user }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href) => pathname === href;

  // Premium Nav Item
  const NavItem = ({ href, children }) => (
    <div className="flex items-center">
      <Link
        href={href}
        onClick={() => setOpen(false)}
        className={`
          relative text-sm md:text-base font-medium
          transition-all duration-300
          ${isActive(href) ? "text-white" : "text-white/70 hover:text-white"}
        `}
      >
        {children}

        {/* Animated underline */}
        <span
          className={`
            absolute left-0 -bottom-1 h-[2px] w-full bg-gradient-to-r
            from-purple-400 to-pink-400 rounded-full transition-all duration-300
            ${isActive(href) ? "opacity-100 scale-100" : "opacity-0 scale-50 group-hover:opacity-100"}
          `}
        />
      </Link>
    </div>
  );

  return (
    <nav className="fixed top-0 inset-x-0 z-50">
      {/* Premium glass background */}
      <div className="backdrop-blur-2xl bg-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.25)] border-b border-white/20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="h-16 flex items-center justify-between">

            {/* LOGO */}
            <Link href="/" className="flex items-center gap-3 select-none">
              <div className="h-8 w-8 rounded-xl bg-white/20 ring-1 ring-white/30 grid place-items-center text-white font-bold shadow-lg shadow-black/20">
                YB
              </div>
              <span className="text-xl font-semibold text-white tracking-tight">
                YourBarrio
              </span>
            </Link>

            {/* DESKTOP MENU */}
            <div className="hidden md:flex items-center gap-x-12">

              <NavItem href="/businesses">Businesses</NavItem>
              <NavItem href="/about">About</NavItem>

              {!user ? (
                <>
                  <NavItem href="/login">Login</NavItem>

                  {/* Premium CTA Button */}
                  <Link
                    href="/register"
                    className="
                      px-5 py-2 rounded-xl font-semibold text-white whitespace-nowrap
                      bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500
                      shadow-[0_4px_20px_rgba(255,0,128,0.35)]
                      hover:brightness-110 active:scale-95 transition-all
                    "
                  >
                    Sign Up
                  </Link>
                </>
              ) : (
                <>
                  <NavItem href="/profile">Profile</NavItem>
                  <LogoutButton />
                </>
              )}
            </div>

            {/* MOBILE MENU ICON */}
            <button
              className="md:hidden text-white hover:text-white/90 transition"
              onClick={() => setOpen(!open)}
            >
              {open ? (
                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    d="M4 6h16M4 12h16M4 18h16" />
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
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-lg text-center font-semibold bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 shadow-md"
                >
                  Sign Up
                </Link>
              </>
            ) : (
              <>
                <NavItem href="/profile">Profile</NavItem>
                <LogoutButton mobile />
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
