"use client";

import Link from "next/link";
import { markAccountNavHandlerStart } from "@/lib/accountNavPerf";
import { markNavInProgress } from "@/lib/nav/safariNavGuard";

const variants = {
  orders: {
    container: "flex items-center gap-3 mb-4",
    active: {
      className:
        "inline-flex items-center justify-center rounded-full border border-transparent px-4 h-11 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60 focus-visible:ring-offset-2",
      style: { background: "var(--text)", color: "var(--background)" },
    },
    inactive: {
      className:
        "inline-flex items-center justify-center rounded-full border px-4 h-11 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60 focus-visible:ring-offset-2",
      style: { borderColor: "var(--border)" },
    },
  },
  history: {
    container: "flex items-center gap-3 mb-4",
    active: {
      className: "rounded-full px-4 py-2 text-sm font-semibold",
      style: { background: "var(--text)", color: "var(--background)" },
    },
    inactive: {
      className: "rounded-full border px-4 py-2 text-sm font-semibold",
      style: { borderColor: "var(--border)" },
    },
  },
};

export default function AccountNavTabs({ active = "orders", variant = "orders" }) {
  const config = variants[variant] || variants.orders;

  const handleClick = (id) => (event) => {
    markAccountNavHandlerStart(id, {
      href: event?.currentTarget?.getAttribute?.("href") || null,
    });
  };

  const handlePointerDown = (href) => () => {
    markNavInProgress(href);
  };

  const isOrders = active === "orders";

  return (
    <div className={config.container}>
      <Link
        href="/account/orders"
        aria-current={isOrders ? "page" : undefined}
        className={isOrders ? config.active.className : config.inactive.className}
        style={isOrders ? config.active.style : config.inactive.style}
        data-perf="account-nav"
        data-perf-id="orders"
        onClick={handleClick("orders")}
        onPointerDownCapture={handlePointerDown("/account/orders")}
      >
        Pending
      </Link>
      <Link
        href="/account/purchase-history"
        aria-current={!isOrders ? "page" : undefined}
        className={!isOrders ? config.active.className : config.inactive.className}
        style={!isOrders ? config.active.style : config.inactive.style}
        data-perf="account-nav"
        data-perf-id="history"
        onClick={handleClick("history")}
        onPointerDownCapture={handlePointerDown("/account/purchase-history")}
      >
        History
      </Link>
    </div>
  );
}
