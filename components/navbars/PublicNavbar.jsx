"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function PublicNavbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Hide navbar on business-auth pages
  if (pathname.startsWith("/business-auth")) return null;

  const isActive = (href) => pathname === href;

  const NavItem = ({ href, children }) => (
    <Link
      href={href}
      className={`relative text-sm md:text-base font-medium transition-all ${
        isActive(href) ? "text-white" : "text-white/70 hover:text-white"
      }`}
      onClick={() => setOpen(false)}
    >
      {children}
    </Link>
  );

  return (
    <nav className="fixed top-0 inset-x-0 z-50">
      <div className="backdrop-blur-xl bg-black/40 border-b border-white/10 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <div className="h-20 flex items-center justify-between">

            {/* LEFT SIDE */}
            <div className="flex items-center gap-x-10">
              <Link href="/" className="select-none">
                <img
                  src="/logo.png"
                  alt="YourBarrio Logo"
                  className="h-10 md:h-32 w-auto"
                />
              </Link>

              <div className="hidden md:flex items-center gap-x-8">
                <NavItem href="/businesses">Businesses</NavItem>
                <NavItem href="/about">About</NavItem>
              </div>
            </div>

            {/* RIGHT SIDE */}
            <div className="hidden md:flex items-center gap-x-6">

              {/* FOR BUSINESS (Single Button, No Dropdown) */}
              <Link
                href="/business"
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white/90 border border-white/20 hover:bg-white/10 transition"
              >
                For Business
              </Link>

              {/* Customer Login */}
              <NavItem href="/auth/login">Log in</NavItem>

              {/* Customer Sign Up */}
              <Link
                href="/auth/register"
                className="px-5 py-2 rounded-xl font-semibold bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 text-white"
              >
                Sign Up
              </Link>
            </div>

            {/* MOBILE MENU BUTTON */}
            <button
              className="md:hidden text-white"
              onClick={() => setOpen((o) => !o)}
            >
              {open ? "✕" : "☰"}
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE MENU */}
      {open && (
        <div className="md:hidden backdrop-blur-xl bg-black/40 border-b border-white/20 shadow-xl">
          <div className="px-6 py-4 flex flex-col gap-4 text-white">

            <NavItem href="/businesses">Businesses</NavItem>
            <NavItem href="/about">About</NavItem>

            {/* FOR BUSINESS */}
            <Link
              href="/business"
              className="px-4 py-2 border border-white/20 rounded-lg text-center font-semibold"
              onClick={() => setOpen(false)}
            >
              For Business
            </Link>

            {/* Customer Login */}
            <NavItem href="/auth/login">Log in</NavItem>

            {/* Customer Sign Up */}
            <Link
              href="/auth/register"
              className="px-4 py-2 bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 rounded-lg text-center font-semibold"
              onClick={() => setOpen(false)}
            >
              Sign Up
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
