"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import HeaderShell from "@/components/headers/HeaderShell";
import NavLink from "@/components/headers/NavLink";
import MobileMenuSheet from "@/components/headers/MobileMenuSheet";

const NAV_ITEMS = [
  { label: "How it works", href: "/business/how-it-works" },
  { label: "Pricing", href: "/business/pricing" },
  { label: "For retailers", href: "/business/retailers" },
  { label: "FAQ", href: "/business/faq" },
];

const LOGIN_HREF = "/business/login";
const CTA_HREF = "/business-auth/register";

function isActivePath(pathname: string, href: string) {
  if (href === "/business") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function BusinessMarketingHeader() {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const firstMobileLinkRef = useRef<HTMLAnchorElement>(null);
  const isBusinessLanding = pathname === "/business";
  const showPrimaryNav = !isBusinessLanding;

  useEffect(() => {
    if (typeof window === "undefined") return;
    lastScrollY.current = window.scrollY;

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      window.requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - lastScrollY.current;

        if (currentY < 20) {
          setHidden(false);
        } else if (currentY > 80 && delta > 0) {
          setHidden(true);
        } else if (delta < 0) {
          setHidden(false);
        }

        lastScrollY.current = currentY;
        ticking.current = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-out ${
          hidden ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        <div className="backdrop-blur-xl bg-gradient-to-r from-purple-950/80 via-purple-900/60 to-fuchsia-900/70 border-b border-white/10 shadow-lg">
          <HeaderShell>
            <div className="flex items-center gap-4">
              <Link href="/business" className="flex items-center gap-3">
                <span className="relative h-9 w-9 scale-[3] origin-left">
                  <Image
                    src="/logo.png"
                    alt="YourBarrio"
                    fill
                    sizes="36px"
                    className="object-contain"
                    priority
                  />
                </span>
                {!isBusinessLanding && (
                  <span className="text-base font-semibold text-white tracking-tight">
                    YourBarrio
                  </span>
                )}
              </Link>
              {showPrimaryNav && (
                <nav className="hidden md:flex items-center gap-6 ml-6">
                  {NAV_ITEMS.map((item) => (
                    <NavLink
                      key={item.href}
                      href={item.href}
                      active={isActivePath(pathname, item.href)}
                      activeClassName="text-white"
                      inactiveClassName="text-white/70 hover:text-white"
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </nav>
              )}
            </div>

            <div className="hidden md:flex items-center gap-4">
              <Link
                href={LOGIN_HREF}
                className="text-sm font-medium text-white/80 hover:text-white transition-colors"
              >
                Log in
              </Link>
              <Link
                href={CTA_HREF}
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-fuchsia-900/30 transition hover:brightness-110"
              >
                Get started
              </Link>
            </div>

            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setMenuOpen(true)}
              className="md:hidden inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-white transition hover:bg-white/10"
            >
              <span className="sr-only">Open menu</span>
              <div className="flex flex-col gap-1">
                <span className="h-0.5 w-5 bg-white" />
                <span className="h-0.5 w-5 bg-white" />
                <span className="h-0.5 w-5 bg-white" />
              </div>
            </button>
          </HeaderShell>
        </div>
      </header>

      <MobileMenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        initialFocusRef={firstMobileLinkRef}
        title="Business menu"
      >
        <div className="flex flex-col gap-4">
          {showPrimaryNav &&
            NAV_ITEMS.map((item, index) => (
              <NavLink
                key={item.href}
                href={item.href}
                active={isActivePath(pathname, item.href)}
                onClick={() => setMenuOpen(false)}
                className="text-base text-white/80 hover:text-white"
                activeClassName="text-white"
                inactiveClassName="text-white/80 hover:text-white"
                ref={index === 0 ? firstMobileLinkRef : undefined}
              >
                {item.label}
              </NavLink>
            ))}
          {showPrimaryNav && <div className="h-px bg-white/10" />}
          <Link
            href={LOGIN_HREF}
            onClick={() => setMenuOpen(false)}
            className="text-sm font-medium text-white/80 hover:text-white"
          >
            Log in
          </Link>
          <Link
            href={CTA_HREF}
            onClick={() => setMenuOpen(false)}
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-fuchsia-900/30"
          >
            Get started
          </Link>
        </div>
      </MobileMenuSheet>
    </>
  );
}
