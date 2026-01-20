"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import ThemeToggle from "../ThemeToggle";
import { useModal } from "../modals/ModalProvider";
import { useTheme } from "../ThemeProvider";
import { useAuth } from "@/components/AuthProvider";
import MobileSidebarDrawer from "@/components/nav/MobileSidebarDrawer";

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

export default function CustomerPublicNavbar() {
  const pathname = usePathname();
  const { openModal } = useModal();
  const [open, setOpen] = useState(false);
  const { hydrated, setTheme } = useTheme();
  const { authStatus } = useAuth();
  const hasForcedLight = useRef(false);
  const hasSession = authStatus === "authenticated";
  const mobileDrawerId = useId();

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(min-width: 768px)");
    const handleChange = () => {
      if (media.matches) setOpen(false);
    };
    handleChange();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (!hydrated || hasForcedLight.current) return;

    const onPublicLanding =
      !pathname.startsWith("/business") &&
      !pathname.startsWith("/business-auth") &&
      !pathname.startsWith("/customer");

    if (onPublicLanding) {
      // Default public landing experience to light theme without blocking user toggles later
      setTheme("light");
      hasForcedLight.current = true;
    }
  }, [hydrated, pathname, setTheme]);

  return (
    <nav
      className="fixed top-0 inset-x-0 z-50 theme-lock"
      data-public-nav
      data-customer-public-navbar="1"
    >
      <div className="backdrop-blur-xl bg-gradient-to-r from-purple-950/80 via-purple-900/60 to-fuchsia-900/70 border-b border-white/10 shadow-lg">
        <div className="w-full px-5 sm:px-6 md:px-8 lg:px-12 xl:px-14">
          <div className="h-20 flex items-center justify-between">
            {/* MOBILE MENU BUTTON */}
            <button
              aria-label="Toggle menu"
              className="md:hidden h-11 w-11 rounded-xl border border-white/15 bg-white/5 text-white flex items-center justify-center shadow-lg active:scale-[0.98] transition mr-2"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls={mobileDrawerId}
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
            {/* LEFT SIDE */}
            <div className="flex items-center gap-x-10">
              <Link href="/" className="select-none">
                <span className="relative block h-10 w-10 md:hidden">
                  <Image
                    src="/business-placeholder2.png"
                    alt="YourBarrio Logo"
                    fill
                    sizes="40px"
                    priority
                    className="object-contain"
                  />
                </span>
                <span className="relative hidden h-10 w-10 md:block md:h-14 md:w-14">
                  <Image
                    src="/logo.png"
                    alt="YourBarrio Logo"
                    fill
                    sizes="56px"
                    priority
                    className="object-contain"
                  />
                </span>
              </Link>

              <div className="hidden md:flex items-center gap-x-8">
                <NavItem
                  href="/about"
                  active={pathname === "/about"}
                  onClick={() => setOpen(false)}
                >
                  About
                </NavItem>
              </div>
            </div>

            {/* RIGHT SIDE */}
            <div className="hidden md:flex items-center gap-x-6">
              <ThemeToggle className="hidden md:flex" />

              <Link
                href="/business"
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white/90 border border-white/20 hover:bg-white/10 transition"
              >
                For Business
              </Link>

              {hasSession ? (
                <Link
                  href="/customer/home"
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white/90 border border-white/20 hover:bg-white/10 transition"
                >
                  My account
                </Link>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => openModal("customer-login")}
                    className="relative text-sm md:text-base font-medium transition-all text-white/70 hover:text-white"
                  >
                    Log in
                  </button>

                  <button
                    type="button"
                    onClick={() => openModal("customer-signup")}
                    className="px-5 py-2 rounded-xl font-semibold bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 text-white"
                  >
                    Sign Up
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      </div>

      <MobileSidebarDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Explore"
        id={mobileDrawerId}
        footer={
          <div className="text-xs text-white/60">
            Trusted community for local businesses and neighbors.
          </div>
        }
      >
        <div className="flex flex-col gap-5 text-white">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/60 mb-3">Navigate</div>
            <div className="flex flex-col gap-3 text-lg font-semibold">
              <NavItem
                href="/about"
                active={pathname === "/about"}
                onClick={() => setOpen(false)}
                className="text-lg font-semibold"
              >
                About YourBarrio
              </NavItem>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <div>
              <div className="text-sm font-semibold">Theme</div>
              <div className="text-xs text-white/60">Match your vibe</div>
            </div>
            <ThemeToggle showLabel={false} />
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href="/business"
              className="w-full text-center px-4 py-3 rounded-xl font-semibold bg-white/5 border border-white/15 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            >
              For Business
            </Link>
            {hasSession ? (
              <Link
                href="/customer/home"
                className="w-full text-center px-4 py-3 rounded-xl font-semibold bg-white/5 border border-white/15 backdrop-blur-sm"
                onClick={() => setOpen(false)}
              >
                My account
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  className="w-full text-center px-4 py-3 rounded-xl font-semibold bg-white/5 border border-white/15 backdrop-blur-sm"
                  onClick={() => {
                    setOpen(false);
                    openModal("customer-login");
                  }}
                >
                  Log in
                </button>
                <button
                  type="button"
                  className="w-full text-center px-4 py-3 rounded-xl font-semibold bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 shadow-lg shadow-fuchsia-900/40"
                  onClick={() => {
                    setOpen(false);
                    openModal("customer-signup");
                  }}
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </MobileSidebarDrawer>
    </nav>
  );
}
