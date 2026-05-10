"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type AdminNavLinkProps = {
  href: string;
  label: string;
  isHorizontal: boolean;
  badgeCount?: number;
  children: ReactNode;
};

export default function AdminNavLink({
  href,
  label,
  isHorizontal,
  badgeCount,
  children,
}: AdminNavLinkProps) {
  const pathname = usePathname() || "/admin";
  const active = href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
  const badgeActive = typeof badgeCount === "number" && badgeCount > 0;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        isHorizontal
          ? `inline-flex rounded-full px-3 py-1.5 text-sm transition-colors ${
              active
                ? "bg-[#6e34ff]/15 text-neutral-50"
                : "text-neutral-300 hover:bg-white/[0.06] hover:text-neutral-100"
            }`
          : `relative inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-[#6e34ff]/12 text-neutral-50"
                : "text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-100"
            }`
      }
    >
      {!isHorizontal && active ? (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-[#8b5cf6]" />
      ) : null}
      {children}
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="min-w-0 truncate">{label}</span>
        {badgeActive ? (
          <span
            className="ml-auto inline-flex min-w-[1.6rem] items-center justify-center rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-rose-100 ring-1 ring-rose-400/25"
            aria-label={`${badgeCount} pending verifications`}
          >
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
