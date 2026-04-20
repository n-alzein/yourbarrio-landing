"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  Compass,
  Home,
  MessageSquare,
  Settings,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils/cx";

const accountItems = [
  {
    href: "/customer/home",
    title: "Home",
    description: "Browse marketplace",
    icon: Home,
  },
  {
    href: "/customer/nearby",
    title: "Nearby businesses",
    description: "Discover local spots near you",
    icon: Compass,
  },
  {
    href: "/customer/messages",
    title: "Messages",
    description: "Chat with businesses",
    icon: MessageSquare,
    showBadge: true,
  },
  {
    href: "/account/orders",
    title: "My Orders",
    description: "Track your orders",
    icon: ShoppingCart,
  },
  {
    href: "/account/purchase-history",
    title: "Purchase History",
    description: "View past orders",
    icon: Bookmark,
  },
  {
    href: "/customer/saved",
    title: "Saved items",
    description: "Your favorites",
    icon: Bookmark,
  },
];

const sidebarGroups = [
  {
    label: "My Barrio",
    items: accountItems.filter(({ href }) =>
      ["/customer/home", "/customer/nearby", "/customer/messages", "/account/orders"].includes(
        href
      )
    ),
  },
  {
    label: "Purchases",
    items: accountItems.filter(({ href }) =>
      ["/account/purchase-history", "/customer/saved"].includes(href)
    ),
  },
  {
    label: "Profile",
    items: [
      {
        href: "/customer/settings",
        title: "Account settings",
        description: "Manage your profile and preferences",
        icon: Settings,
      },
    ].filter(Boolean),
  },
];

function isActivePath(pathname, href) {
  if (!pathname) return false;
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

export default function AccountMenuItems({
  variant = "dropdown",
  isCustomer = false,
  isBusiness = false,
  unreadCount = 0,
  onNavigate,
  logout = null,
}) {
  const pathname = usePathname();

  if (variant === "dropdown") {
    return (
      <>
        {isCustomer ? (
          <div className="px-2 pb-1 pt-2 space-y-1">
            {accountItems.map(({ href, title, description, icon: Icon, showBadge }) => (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-white/10 touch-manipulation text-left"
                data-safe-nav="1"
              >
                <div className="h-11 w-11 rounded-2xl bg-white/10 flex items-center justify-center text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{title}</p>
                    {showBadge && unreadCount > 0 ? (
                      <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                        {unreadCount}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs yb-dropdown-muted">{description}</p>
                </div>
              </Link>
            ))}

            {isBusiness ? (
              <Link
                href="/go/dashboard"
                onClick={onNavigate}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-white/10 touch-manipulation text-left"
                data-safe-nav="1"
              >
                <div className="h-11 w-11 rounded-2xl bg-white/10 flex items-center justify-center text-white">
                  <Settings className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Business dashboard</p>
                  <p className="text-xs yb-dropdown-muted">Manage your profile</p>
                </div>
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className="mt-2 border-t border-white/10 px-4 pt-3">
          {isCustomer ? (
            <Link
              href="/customer/settings"
              onClick={onNavigate}
              className="flex w-full items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold transition hover:bg-white/10 touch-manipulation text-left"
              data-safe-nav="1"
            >
              <span className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Account settings
              </span>
            </Link>
          ) : null}
          {logout ? <div className="mt-3">{logout}</div> : null}
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {isCustomer ? (
        <div>
          <div className="space-y-7">
            {sidebarGroups.map((group, groupIndex) => (
              <div
                key={group.label}
                className={cn(
                  groupIndex > 0 && "border-t border-gray-100 pt-7",
                  group.label === "Profile" && "pt-8"
                )}
              >
                <p className="mb-2 text-xs uppercase tracking-wide text-gray-400/80">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map(({ href, title, description, icon: Icon, showBadge }) => {
                    const active = isActivePath(pathname, href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={onNavigate}
                        className={cn(
                          "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150 hover:bg-gray-50",
                          active && "bg-purple-100 hover:bg-purple-100"
                        )}
                        data-safe-nav="1"
                        aria-current={active ? "page" : undefined}
                      >
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-none bg-gray-50 text-gray-600 transition-colors duration-150 group-hover:text-gray-800",
                            active && "text-purple-600 group-hover:text-purple-600"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-[15px] font-semibold leading-5 text-gray-900">
                              {title}
                            </span>
                            {showBadge && unreadCount > 0 ? (
                              <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                                {unreadCount}
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block text-[13px] leading-4 text-gray-500">
                            {description}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {isBusiness ? (
        <div>
          <p className="yb-sidebar-section-title">
            Business
          </p>
          <div className="mt-3">
            <Link
              href="/go/dashboard"
              onClick={onNavigate}
              className="yb-sidebar-item flex w-full items-start gap-3 px-3 py-3 text-left transition"
              data-safe-nav="1"
            >
              <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--yb-border)] bg-white">
                <Settings className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-sm font-semibold">Business dashboard</span>
                <span className="mt-1 block text-xs yb-dropdown-muted">
                  Manage your profile
                </span>
              </span>
            </Link>
          </div>
        </div>
      ) : null}

      {logout ? <div className="border-t border-[var(--yb-border)] pt-4">{logout}</div> : null}
    </div>
  );
}
