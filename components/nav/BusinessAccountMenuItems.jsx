"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils/cx";

function isActivePath(pathname, href) {
  if (!pathname) return false;
  if (pathname === href) return true;
  if (href === "/go/dashboard" && pathname === "/business/dashboard") return true;
  return pathname.startsWith(`${href}/`);
}

function BusinessSidebarItem({
  href,
  title,
  description,
  icon: Icon,
  showBadge = false,
  unreadCount = 0,
  onNavigate,
}) {
  const pathname = usePathname();
  const active = isActivePath(pathname, href);

  return (
    <Link
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
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-gray-50 text-gray-600 transition-colors duration-150 group-hover:text-gray-800",
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
}

export default function BusinessAccountMenuItems({
  items = [],
  unreadCount = 0,
  onNavigate,
  logout = null,
}) {
  return (
    <div className="flex flex-col gap-7">
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400/80">
          Business
        </p>
        <div className="mt-3 space-y-0.5">
          {items.map(({ href, title, description, icon: Icon, showBadge }) => (
            <BusinessSidebarItem
              key={href}
              href={href}
              title={title}
              description={description}
              icon={Icon}
              showBadge={showBadge}
              unreadCount={unreadCount}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-gray-100 pt-7">
        <div className="space-y-0.5">
          <BusinessSidebarItem
            href="/go/account"
            title="Account settings"
            description="Manage billing and preferences"
            icon={Settings}
            onNavigate={onNavigate}
          />
        </div>
      </div>

      {logout ? <div className="border-t border-gray-100 pt-5">{logout}</div> : null}
    </div>
  );
}
