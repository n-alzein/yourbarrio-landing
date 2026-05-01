"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/cart/CartProvider";

const HIDDEN_ROLES = new Set(["business", "admin", "internal"]);

export default function CartNavActionClient({ variant = "desktop", onNavigate }) {
  const { user, role, authStatus } = useAuth();
  const { itemCount } = useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  if (!mounted) return null;
  const isMobileNavbar = variant === "mobile-navbar";
  if (!isMobileNavbar && authStatus === "loading" && itemCount <= 0) return null;
  if (!isMobileNavbar && !user && itemCount <= 0) return null;
  if (HIDDEN_ROLES.has(role || "")) return null;

  if (isMobileNavbar) {
    return (
      <Link
        href="/cart"
        onClick={() => onNavigate?.()}
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-purple-300/50 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/35"
        aria-label={itemCount > 0 ? `View cart, ${itemCount} items` : "View cart"}
        data-safe-nav="1"
      >
        <ShoppingCart className="h-[18px] w-[18px]" />
        {itemCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full border border-slate-950/20 bg-amber-300 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-slate-950 shadow-sm">
            {itemCount}
          </span>
        ) : null}
      </Link>
    );
  }

  if (variant === "mobile-row") {
    const itemLabel = itemCount === 1 ? "1 item" : `${itemCount} items`;

    return (
      <Link
        href="/cart"
        onClick={() => onNavigate?.()}
        className="group flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-[var(--yb-border)] bg-white px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/20"
        aria-label={`View cart, ${itemLabel}`}
        data-safe-nav="1"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="yb-guest-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 transition group-hover:bg-slate-200">
            <ShoppingCart className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="yb-guest-strong block text-sm font-bold">Cart</span>
            <span className="yb-guest-muted block text-xs">{itemLabel}</span>
          </span>
        </span>
        {itemCount > 0 ? (
          <span className="yb-guest-cart-badge rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold">
            {itemCount}
          </span>
        ) : null}
      </Link>
    );
  }

  if (variant === "mobile") {
    return (
      <Link
        href="/cart"
        onClick={() => onNavigate?.()}
        className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--yb-border)] bg-white transition hover:bg-black/5"
        aria-label="View cart"
        data-safe-nav="1"
      >
        <ShoppingCart className="h-5 w-5" />
        {itemCount > 0 ? (
          <span className="absolute -top-2 -right-2 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold text-black">
            {itemCount}
          </span>
        ) : null}
      </Link>
    );
  }

  return (
    <Link
      href="/cart"
      className="relative text-white/90 transition-colors duration-200 ease-out hover:text-purple-400"
      aria-label="View cart"
      data-nav-guard="1"
    >
      <ShoppingCart className="h-6 w-6" />
      {itemCount > 0 ? (
        <span className="absolute -top-2 -right-2 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold text-black">
          {itemCount}
        </span>
      ) : null}
    </Link>
  );
}
