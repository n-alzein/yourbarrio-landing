"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ThemeToggle from "../ThemeToggle";
import { useModal } from "../modals/ModalProvider";
import { useTheme } from "../ThemeProvider";
import { useAuth } from "../AuthProvider";

export default function PublicNavbar() {
  const pathname = usePathname();
  const { openModal } = useModal();
  const [open, setOpen] = useState(false);
  const [forceHidden, setForceHidden] = useState(false);
  const { hydrated, setTheme } = useTheme();
  const hasForcedLight = useRef(false);
  const { authUser, role, loadingUser } = useAuth();
  const [livePathname, setLivePathname] = useState(pathname);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updatePath = () => setLivePathname(window.location.pathname);
    updatePath();

    const handlePopState = () => updatePath();
    window.addEventListener("popstate", handlePopState);

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    const wrap = (original) => {
      return function wrappedState(...args) {
        const result = original.apply(this, args);
        updatePath();
        return result;
      };
    };

    window.history.pushState = wrap(originalPushState);
    window.history.replaceState = wrap(originalReplaceState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  const effectivePath = livePathname || pathname;
  const isAppRoute =
    effectivePath?.startsWith("/business") ||
    effectivePath?.startsWith("/customer");
  const shouldRender = !loadingUser && !authUser && !role && !isAppRoute;

  useEffect(() => {
    if (effectivePath?.startsWith("/business") || effectivePath?.startsWith("/customer")) {
      setForceHidden(true);
    }
  }, [effectivePath]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleClick = (event) => {
      const link = event.target?.closest?.("a");
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("http")) return;
      if (href.startsWith("/business") || href.startsWith("/customer")) {
        setForceHidden(true);
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  useEffect(() => {
    if (!shouldRender) {
      if (typeof document !== "undefined") {
        document.body.style.overflow = "";
      }
      return;
    }
    // Prevent background scroll when the mobile menu is open
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, shouldRender]);

  useEffect(() => {
    if (!shouldRender) return;
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

  if (!shouldRender || forceHidden) {
    return null;
  }

  return (
    <nav className="fixed top-0 inset-x-0 z-50 theme-lock" data-public-nav>
      <div className="backdrop-blur-xl bg-gradient-to-r from-purple-950/80 via-purple-900/60 to-fuchsia-900/70 border-b border-white/10 shadow-lg">
        <div className="w-full px-5 sm:px-6 md:px-8 lg:px-12 xl:px-14">
          <div className="h-20 flex items-center justify-between">

            {/* LEFT SIDE */}
            <div className="flex items-center gap-x-10">
              <Link href="/" className="select-none">
                <img
                  src="/logo.png"
                  alt="YourBarrio Logo"
                  className="h-34 md:h-32 w-auto"
                />
              </Link>

              <div className="hidden md:flex items-center gap-x-8">
                <NavItem href="/about">About</NavItem>
              </div>
            </div>

            {/* RIGHT SIDE */}
            <div className="hidden md:flex items-center gap-x-6">
              <ThemeToggle className="hidden md:flex" />

              {/* FOR BUSINESS (Single Button, No Dropdown) */}
              <Link
                href="/business"
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white/90 border border-white/20 hover:bg-white/10 transition"
              >
                For Business
              </Link>

              {/* Customer Login */}
              <button
                type="button"
                onClick={() => openModal("customer-login")}
                className="relative text-sm md:text-base font-medium transition-all text-white/70 hover:text-white"
              >
                Log in
              </button>

              {/* Customer Sign Up */}
              <button
                type="button"
                onClick={() => openModal("customer-signup")}
                className="px-5 py-2 rounded-xl font-semibold bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 text-white"
              >
                Sign Up
              </button>
            </div>

            {/* MOBILE MENU BUTTON */}
            <button
              aria-label="Toggle menu"
              className="md:hidden h-11 w-11 rounded-xl border border-white/15 bg-white/5 text-white flex items-center justify-center shadow-lg active:scale-[0.98] transition"
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
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xl"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 top-20 px-4 pb-6">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-purple-950/90 via-purple-900/80 to-fuchsia-900/80 shadow-2xl text-white">
              <div className="px-6 pt-6 pb-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/60 mb-3">Navigate</div>
                <div className="flex flex-col gap-3 text-lg font-semibold">
                  <NavItem href="/about">About YourBarrio</NavItem>
                </div>
              </div>

              <div className="h-px bg-white/10 mx-6" />

              <div className="px-6 py-5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Theme</div>
                  <div className="text-xs text-white/60">Match your vibe</div>
                </div>
                <ThemeToggle showLabel={false} />
              </div>

              <div className="h-px bg-white/10 mx-6" />

              <div className="px-6 py-6 flex flex-col gap-3">
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
              </div>

              <div className="px-6 pb-6 text-xs text-white/60">
                Trusted community for local businesses and neighbors.
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
