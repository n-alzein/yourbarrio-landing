"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { openBusinessAuthPopup } from "@/lib/openBusinessAuthPopup";
import { AUTH_UI_RESET_EVENT } from "@/components/AuthProvider";

function NavItem({ href, children, active, onClick, className }) {
  return (
    <Link
      href={href}
      className={`relative text-sm md:text-base font-medium transition-all ${
        active ? "text-white" : "text-white/70 hover:text-white"
      } ${className || ""}`}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}

export default function BusinessMarketingNavbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // Prevent background scroll when the mobile menu is open
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleReset = () => {
      setOpen(false);
    };
    window.addEventListener(AUTH_UI_RESET_EVENT, handleReset);
    return () => window.removeEventListener(AUTH_UI_RESET_EVENT, handleReset);
  }, []);

  const handlePopup = (event, path) => {
    event.preventDefault();
    openBusinessAuthPopup(path);
  };

  return (
    <nav
      className="fixed top-0 inset-x-0 z-50 theme-lock yb-navbar yb-navbar-bordered"
      data-public-nav
      data-business-public-navbar="1"
    >
      <div>
        <div className="w-full px-5 sm:px-6 md:px-8 lg:px-12 xl:px-14">
          <div className="h-20 flex items-center justify-between">
            {/* LEFT SIDE */}
            <div className="flex items-center gap-x-10">
              <Link href="/business" className="select-none">
                <span className="relative block h-10 w-10 md:h-32 md:w-32">
                  <Image
                    src="/logo.png"
                    alt="YourBarrio Logo"
                    fill
                    sizes="128px"
                    priority
                    className="object-contain"
                  />
                </span>
              </Link>

              <div className="hidden md:flex items-center gap-x-8">
                <NavItem
                  href="/business/about"
                  active={pathname === "/business/about"}
                  onClick={() => setOpen(false)}
                >
                  About
                </NavItem>
              </div>
            </div>

            {/* RIGHT SIDE */}
            <div className="hidden md:flex items-center gap-x-6">
              <Link
                href="/"
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white/90 border border-white/20 hover:bg-white/10 transition"
              >
                For Customers
              </Link>

              <Link
                href="/business/login"
                onClick={(e) => handlePopup(e, "/business-auth/login")}
                className="relative text-sm md:text-base font-medium transition-all text-white/70 hover:text-white"
              >
                Business Login
              </Link>

              <Link
                href="/business-auth/register"
                onClick={(e) => handlePopup(e, "/business-auth/register")}
                className="px-5 py-2 rounded-xl font-semibold bg-[var(--color-primary)] text-white"
              >
                Create Account
              </Link>
            </div>

            {/* MOBILE MENU BUTTON */}
            <button
              aria-label="Toggle menu"
              className="md:hidden h-11 w-11 rounded-xl border border-white/15 bg-white/5 text-white flex items-center justify-center active:scale-[0.98] transition"
              onClick={() => setOpen((o) => !o)}
            >
              <div className="flex flex-col gap-1.5">
                <span
                  className={`block h-0.5 w-6 rounded-full bg-white transition-transform ${
                    open ? "translate-y-2 rotate-45" : ""
                  }`}
                />
                <span
                  className={`block h-0.5 w-4 rounded-full bg-white transition ${
                    open ? "opacity-0" : ""
                  }`}
                />
                <span
                  className={`block h-0.5 w-6 rounded-full bg-white transition-transform ${
                    open ? "-translate-y-2 -rotate-45" : ""
                  }`}
                />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE MENU */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 top-20 px-4 pb-6">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-[var(--yb-navbar-bg)] text-white">
              <div className="px-6 pt-6 pb-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/60 mb-3">Navigate</div>
                <div className="flex flex-col gap-3 text-lg font-semibold">
                  <NavItem
                    href="/business/about"
                    active={pathname === "/business/about"}
                    onClick={() => setOpen(false)}
                    className="text-lg font-semibold"
                  >
                    About YourBarrio
                  </NavItem>
                </div>
              </div>

              <div className="h-px bg-white/10 mx-6" />

              <div className="px-6 py-6 flex flex-col gap-3">
                <Link
                  href="/"
                  className="w-full text-center px-4 py-3 rounded-xl font-semibold bg-white/5 border border-white/15"
                  onClick={() => setOpen(false)}
                >
                  For Customers
                </Link>
                <Link
                  href="/business/login"
                  className="w-full text-center px-4 py-3 rounded-xl font-semibold bg-white/5 border border-white/15"
                  onClick={(e) => {
                    setOpen(false);
                    handlePopup(e, "/business-auth/login");
                  }}
                >
                  Business Login
                </Link>
                <Link
                  href="/business-auth/register"
                  className="w-full text-center px-4 py-3 rounded-xl font-semibold bg-[var(--color-primary)]"
                  onClick={(e) => {
                    setOpen(false);
                    handlePopup(e, "/business-auth/register");
                  }}
                >
                  Create Account
                </Link>
              </div>

              <div className="px-6 pb-6 text-xs text-white/60">
                Built for neighborhood business growth.
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
