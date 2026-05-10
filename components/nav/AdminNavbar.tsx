"use client";

import Image from "next/image";
import Link from "next/link";

type AdminNavbarProps = {
  onOpenMobileSidebar?: () => void;
};

export default function AdminNavbar({ onOpenMobileSidebar }: AdminNavbarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 m-0 z-[5000] theme-lock pointer-events-auto yb-navbar yb-navbar-bordered yb-admin-navbar bg-neutral-950">
      <div className="relative flex h-12 w-full items-center gap-3 px-3 sm:px-6 md:h-16 md:gap-4 md:px-8 lg:px-10">
        <Link href="/admin" aria-label="Go to admin dashboard" className="touch-manipulation">
          <span className="relative block h-7 w-7 md:hidden">
            <Image
              src="/business-placeholder2.png"
              alt="YourBarrio"
              fill
              sizes="28px"
              priority
              className="object-contain"
            />
          </span>
          <span className="relative hidden h-9 w-28 md:block">
            <Image
              src="/logo.png"
              alt="YourBarrio"
              fill
              sizes="112px"
              priority
              className="object-contain"
            />
          </span>
        </Link>

        <p className="absolute left-1/2 -translate-x-1/2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55 md:static md:ml-auto md:translate-x-0 md:text-xs">
          ADMIN ACCOUNT
        </p>

        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-md text-neutral-100 md:hidden"
          aria-label="Open admin menu"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.12] bg-white/[0.05]">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </span>
        </button>
      </div>
    </nav>
  );
}
