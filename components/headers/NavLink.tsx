"use client";

import Link from "next/link";
import { forwardRef } from "react";
import type { ReactNode, MouseEventHandler } from "react";

type NavLinkProps = {
  href: string;
  children: ReactNode;
  active?: boolean;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  activeClassName?: string;
  inactiveClassName?: string;
};

const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  (
    {
      href,
      children,
      active = false,
      className = "",
      onClick,
      activeClassName = "text-slate-900",
      inactiveClassName = "text-slate-600 hover:text-slate-900",
    },
    ref
  ) => {
    return (
      <Link
        ref={ref}
        href={href}
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={`text-sm font-medium transition-colors ${
          active ? activeClassName : inactiveClassName
        } ${className}`.trim()}
      >
        {children}
      </Link>
    );
  }
);

NavLink.displayName = "NavLink";

export default NavLink;
