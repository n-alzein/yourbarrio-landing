"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import BusinessAvatarSurface from "@/components/business/BusinessAvatarSurface";
import BusinessCoverSurface from "@/components/business/BusinessCoverSurface";
import { useAuth } from "@/components/AuthProvider";
import SaveBusinessButton from "@/components/business/SaveBusinessButton";
import { useModal } from "@/components/modals/ModalProvider";
import { setAuthIntent } from "@/lib/auth/authIntent";
import { useSavedBusinesses } from "@/lib/hooks/useSavedBusinesses";
import { cx } from "@/lib/utils/cx";
import { getOrCreateConversation } from "@/lib/messages";
import {
  Clock3,
  Globe,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Share2,
  Star,
  Loader2,
} from "lucide-react";
import { getBusinessTypeLabel } from "@/lib/taxonomy/compat";
import {
  getBusinessAvatarImage,
  getBusinessCoverImage,
} from "@/lib/businessImages";
import {
  normalizeUrl,
  formatTime,
  formatHoursValue,
  parseHours,
  toObject,
} from "@/lib/business/profileUtils";

const NAV_OFFSET = 152;
const PENDING_AUTH_ACTION_STORAGE_KEY = "yb:pendingAuthAction";

export { normalizeUrl, formatTime, formatHoursValue, parseHours, toObject };

export function buildAuthReturnPath(pathname, searchParamsString = "") {
  const safePath = typeof pathname === "string" && pathname.startsWith("/") ? pathname : "/";
  const safeSearch = typeof searchParamsString === "string" ? searchParamsString.trim() : "";
  return `${safePath}${safeSearch ? `?${safeSearch}` : ""}`;
}

export function buildLoginHrefForReturnPath(returnPath) {
  const safeReturnPath =
    typeof returnPath === "string" && returnPath.startsWith("/") && !returnPath.startsWith("//")
      ? returnPath
      : "/";
  return `/login?next=${encodeURIComponent(safeReturnPath)}`;
}

function writePendingAuthAction(intent) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PENDING_AUTH_ACTION_STORAGE_KEY, JSON.stringify(intent));
  } catch {}
}

export function getProfileIdentity(profile) {
  const name = profile?.business_name || profile?.full_name || "Business profile";
  const businessType = getBusinessTypeLabel(profile, "Local business");
  const city = profile?.city || "";
  const location = [city, profile?.state].filter(Boolean).join(", ");
  const avatarImage = getBusinessAvatarImage(profile || {});
  const coverSrc = getBusinessCoverImage(profile || {});

  return {
    name,
    businessType,
    city,
    location,
    avatarImage,
    coverSrc,
  };
}

function buildDirectionsUrl(profile) {
  const query = [profile?.address, profile?.city, profile?.state]
    .filter(Boolean)
    .join(", ");
  if (!query) return "";
  return `https://maps.google.com/?q=${encodeURIComponent(query)}`;
}

function getHoursStatus(profile) {
  const raw = toObject(profile?.hours_json);
  if (!raw || typeof raw !== "object" || !Object.keys(raw).length) {
    return { label: null, tone: "muted", available: false };
  }

  const weekdayMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const now = new Date();
  const today = raw?.[weekdayMap[now.getDay()]];

  if (!today || typeof today !== "object") {
    return { label: "Hours listed", tone: "neutral", available: true };
  }
  if (today.isClosed) {
    return { label: "Closed today", tone: "muted", available: true };
  }
  if (!(today.open && today.close)) {
    return { label: "Hours listed", tone: "neutral", available: true };
  }

  const [openHour = 0, openMinute = 0] = String(today.open)
    .split(":")
    .map((value) => Number(value));
  const [closeHour = 0, closeMinute = 0] = String(today.close)
    .split(":")
    .map((value) => Number(value));
  if (
    [openHour, openMinute, closeHour, closeMinute].some((value) =>
      Number.isNaN(value)
    )
  ) {
    return { label: "Hours listed", tone: "neutral", available: true };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = openHour * 60 + openMinute;
  const closeMinutes = closeHour * 60 + closeMinute;
  const isOpen =
    closeMinutes >= openMinutes
      ? currentMinutes >= openMinutes && currentMinutes <= closeMinutes
      : currentMinutes >= openMinutes || currentMinutes <= closeMinutes;

  return {
    label: isOpen ? "Open now" : "Closed now",
    tone: isOpen ? "success" : "muted",
    available: true,
  };
}

function scrollToSection(id) {
  if (typeof window === "undefined") return;
  const element = document.getElementById(id);
  if (!element) return;
  const top = element.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
  window.scrollTo({ top, behavior: "smooth" });
}

export function ProfilePageShell({ children, className = "" }) {
  return (
    <div
      className={cx(
        "min-h-screen bg-[#f6f7fb] text-slate-950 business-theme",
        className
      )}
    >
      <div className="mx-auto max-w-[1180px] px-4 pb-12 pt-0 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}

export function ProfileSection({
  id,
  title,
  description,
  action,
  children,
  className = "",
  contentClassName = "",
  hideHeader = false,
}) {
  return (
    <section id={id} className={cx("scroll-mt-40 border-t border-slate-100 pt-8 md:pt-10", className)}>
      {!hideHeader ? (
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-[1.18rem] font-semibold tracking-[-0.03em] text-slate-950 sm:text-[1.28rem]">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0 self-start md:self-end">{action}</div> : null}
        </div>
      ) : null}
      <div className={cx("bg-transparent", contentClassName)}>{children}</div>
    </section>
  );
}

export function ProfileEmptyState({
  title,
  detail,
  icon: Icon,
  action,
  className = "",
}) {
  return (
    <div
      className={cx(
        "rounded-[16px] border border-slate-100 bg-white px-4 py-4 shadow-sm",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {Icon ? (
          <div className="rounded-xl bg-slate-50 p-2 text-[#6a3df0]">
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">{title}</p>
          {detail ? <p className="mt-1 text-sm leading-6 text-slate-500">{detail}</p> : null}
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function ProfileSectionNav({ items, className = "", attached = false }) {
  const [activeId, setActiveId] = useState(items?.[0]?.id || "");

  useEffect(() => {
    if (typeof window === "undefined" || !items?.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-25% 0px -60% 0px",
        threshold: [0.15, 0.35, 0.6],
      }
    );

    items.forEach((item) => {
      const node = document.getElementById(item.id);
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, [items]);

  return (
    <div
      className={cx(
        attached
          ? "sticky top-16 z-20 mb-5"
          : "sticky top-16 z-20 mb-5 overflow-x-auto border-b border-slate-200/80 bg-white/95 backdrop-blur",
        className
      )}
    >
      {attached ? (
        <div className="border-b border-slate-200/85 bg-white/96 shadow-[0_14px_38px_-42px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="mx-auto max-w-[1180px] overflow-x-auto px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-max items-center gap-8">
              {items.map((item) => {
                const active = item.id === activeId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    className={cx(
                      "relative min-h-12 px-0 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8b9ff] focus-visible:ring-offset-2",
                      active
                        ? "text-[#5b37d6] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[#6E34FF]"
                        : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex min-w-max max-w-[1180px] items-center gap-6 px-4 sm:px-6 lg:px-8">
          {items.map((item) => {
            const active = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className={cx(
                  "relative min-h-11 px-0 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8b9ff] focus-visible:ring-offset-2",
                  active
                    ? "text-[#5b37d6] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[#6E34FF]"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PreviewMetaChip({ icon: Icon, children, tone = "default" }) {
  const toneClassName =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "muted"
        ? "border-slate-200 bg-slate-50 text-slate-600"
        : "border-[#e5dcff] bg-[#f6f1ff] text-[#5b37d6]";

  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium",
        toneClassName
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </span>
  );
}

function HeroMetadata({ location, ratingSummary, businessType, profile }) {
  const count = ratingSummary?.count || 0;
  const average = Number(ratingSummary?.average || 0);
  const hoursStatus = getHoursStatus(profile);
  const reviewLabel = count
    ? `${average.toFixed(1)} · ${count} review${count === 1 ? "" : "s"}`
    : "No reviews yet";

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
        {location ? (
          <span className="inline-flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#6a3df0]" />
            {location}
          </span>
        ) : null}
        {count ? (
          <button
            type="button"
            onClick={() => scrollToSection("reviews")}
            className="inline-flex items-center gap-2 rounded-full text-left transition hover:text-[#5b37d6] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8b9ff] focus-visible:ring-offset-2"
            aria-label="Jump to reviews"
          >
            <Star className="h-4 w-4 text-amber-500" fill="currentColor" />
            {reviewLabel}
          </button>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" fill="currentColor" />
            {reviewLabel}
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {businessType ? (
          <PreviewMetaChip tone="muted">{businessType}</PreviewMetaChip>
        ) : null}
        {hoursStatus.available ? (
          <PreviewMetaChip icon={Clock3} tone={hoursStatus.tone}>
            {hoursStatus.label}
          </PreviewMetaChip>
        ) : null}
      </div>
    </>
  );
}

function HeroActionIconButton({ href, icon: Icon, label, onClick, variant = "default" }) {
  const baseClassName = cx(
    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-[#f3efff] hover:text-[#5b37d6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8b9ff] focus-visible:ring-offset-2",
    variant === "elevated" ? "h-11 w-11 rounded-[16px] md:h-10 md:w-10 md:rounded-full" : "",
    variant === "elevated" ? "border border-slate-200 bg-white shadow-sm" : ""
  );

  if (href) {
    return (
      <a
        href={href}
        target={href.startsWith("tel:") ? undefined : "_blank"}
        rel={href.startsWith("tel:") ? undefined : "noreferrer"}
        aria-label={label}
        title={label}
        className={baseClassName}
      >
        <Icon className="h-4 w-4" />
      </a>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={baseClassName}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function HeroActionButton({
  href,
  icon: Icon,
  label,
  tone = "outline",
  onClick,
  variant = "default",
  className: classNameOverride = "",
  mobileIconOnly = false,
}) {
  const className = cx(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8b9ff] focus-visible:ring-offset-2",
    tone === "primary"
      ? "dashboard-primary-action bg-[#6E34FF] text-white shadow-[0_16px_34px_-24px_rgba(106,61,240,0.75)] hover:bg-[#5E2DE0]"
      : variant === "elevated"
        ? "border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-[#c8b9ff] hover:bg-[#f8f5ff] hover:text-[#5b37d6]"
        : "border border-slate-300 bg-white text-slate-800 hover:border-[#c8b9ff] hover:bg-[#f8f5ff] hover:text-[#5b37d6]",
    classNameOverride
  );
  const primaryStyle = tone === "primary" ? { color: "#ffffff" } : undefined;
  const labelClassName = mobileIconOnly ? "sr-only md:not-sr-only" : "";

  if (href) {
    return (
      <a
        href={href}
        target={href.startsWith("tel:") ? undefined : "_blank"}
        rel={href.startsWith("tel:") ? undefined : "noreferrer"}
        aria-label={mobileIconOnly ? label : undefined}
        title={mobileIconOnly ? label : undefined}
        className={className}
        style={primaryStyle}
      >
        {Icon ? <Icon className="h-4 w-4" style={primaryStyle} /> : null}
        <span className={labelClassName} style={primaryStyle}>{label}</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={mobileIconOnly ? label : undefined}
      title={mobileIconOnly ? label : undefined}
      className={className}
      style={primaryStyle}
    >
      {Icon ? <Icon className="h-4 w-4" style={primaryStyle} /> : null}
      <span className={labelClassName} style={primaryStyle}>{label}</span>
    </button>
  );
}

function HeroPreviewActions({
  profile,
  publicPath,
  viewerMode = "public",
  ownerPrimaryAction = null,
  ownerSecondaryActions = [],
  variant = "default",
}) {
  const [copied, setCopied] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const { user, role, supabase } = useAuth();
  const { openModal } = useModal();
  const {
    savedBusinessIds,
    savingBusinessIds,
    showSaveControls,
    toggleSavedBusiness,
  } = useSavedBusinesses();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const website = profile?.website ? normalizeUrl(profile.website) : "";
  const directions = buildDirectionsUrl(profile);
  const businessId = String(profile?.id || profile?.owner_user_id || "").trim();
  const saveBusinessId = String(profile?.business_row_id || profile?.business_id || "").trim();
  const showSaveBusinessButton =
    viewerMode !== "owner" && showSaveControls && Boolean(saveBusinessId);
  const isBusinessSaved = saveBusinessId ? savedBusinessIds.has(saveBusinessId) : false;
  const currentQuery = searchParams?.toString() || "";
  const loginTarget = buildAuthReturnPath(
    pathname || publicPath || (businessId ? `/b/${encodeURIComponent(businessId)}` : "/"),
    currentQuery
  );
  const loginHref = buildLoginHrefForReturnPath(loginTarget);
  const canMessageDirectly =
    viewerMode !== "owner" &&
    Boolean(user?.id) &&
    role !== "business" &&
    user?.id !== businessId;
  const inlineActionClassName =
    variant === "elevated"
      ? "inline-flex min-h-9 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium text-slate-600 transition hover:bg-[#f3efff] hover:text-[#5b37d6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8b9ff] focus-visible:ring-offset-2"
      : "inline-flex min-h-9 items-center justify-center rounded-full px-1 text-sm font-medium text-slate-600 transition hover:text-[#5b37d6]";
  const ownerActions = Array.isArray(ownerSecondaryActions)
    ? ownerSecondaryActions.filter(Boolean)
    : [];

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    console.info("[auth-next] CTA href:", {
      pathname: pathname || null,
      query: currentQuery || "",
      loginTarget,
      loginHref,
    });
  }, [currentQuery, loginHref, loginTarget, pathname]);

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const shareUrl = publicPath
      ? new URL(publicPath, window.location.origin).toString()
      : window.location.href;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  const handleMessage = async () => {
    if (!canMessageDirectly || !businessId || messageLoading) return;
    setMessageLoading(true);
    try {
      const conversationId = await getOrCreateConversation({
        supabase,
        businessId,
      });
      if (conversationId) {
        router.push(`/customer/messages/${conversationId}`);
      }
    } finally {
      setMessageLoading(false);
    }
  };

  const handleGuestMessageIntent = () => {
    setAuthIntent({ redirectTo: loginTarget, role: "customer" });
    writePendingAuthAction({
      type: "message_business",
      pathname: loginTarget,
      businessId,
      businessSlug: profile?.public_id || null,
    });
    openModal("customer-login", { next: loginTarget });
  };

  if (viewerMode === "owner" && variant === "elevated") {
    return (
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
          {ownerPrimaryAction ? (
            <HeroActionButton
              icon={ownerPrimaryAction.icon}
              label={ownerPrimaryAction.label}
              onClick={ownerPrimaryAction.onClick}
              tone="primary"
              variant={variant}
            />
          ) : null}

          {ownerActions.map((action) => {
            const Icon = action.icon;
            const className =
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-[16px] border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-[#c8b9ff] hover:bg-[#f8f5ff] hover:text-[#5b37d6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8b9ff] focus-visible:ring-offset-2";

            return action.href ? (
              <Link key={action.label} href={action.href} className={className}>
                {Icon ? <Icon className="h-4 w-4" /> : null}
                <span>{action.label}</span>
              </Link>
            ) : (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className={className}
              >
                {Icon ? <Icon className="h-4 w-4" /> : null}
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex w-full items-center justify-end gap-2">
          {directions ? (
            <HeroActionIconButton
              href={directions}
              icon={MapPin}
              label="Directions"
              variant={variant}
            />
          ) : null}
          {website ? (
            <HeroActionIconButton
              href={website}
              icon={Globe}
              label="Website"
              variant={variant}
            />
          ) : null}
          {profile?.phone ? (
            <HeroActionIconButton
              href={`tel:${profile.phone}`}
              icon={Phone}
              label="Call"
              variant={variant}
            />
          ) : null}
          <HeroActionIconButton
            icon={Share2}
            label={copied ? "Copied" : "Share"}
            onClick={handleShare}
            variant={variant}
          />
        </div>
      </div>
    );
  }

  if (variant === "elevated") {
    return (
      <div className="flex w-full flex-col gap-2 lg:items-end">
        <div className="flex w-full items-center justify-between gap-2 md:flex-wrap md:justify-start lg:justify-end">
          {directions ? (
            <HeroActionButton
              href={directions}
              icon={MapPin}
              label="Directions"
              tone="primary"
              variant={variant}
              mobileIconOnly
              className="h-11 w-11 min-h-11 rounded-[16px] p-0 text-xs shadow-[0_14px_32px_-18px_rgba(106,61,240,0.78)] md:h-auto md:w-auto md:min-h-11 md:rounded-[14px] md:px-4 md:py-2.5 md:text-sm"
            />
          ) : null}
          {website ? (
            <HeroActionButton
              href={website}
              icon={Globe}
              label="Website"
              variant={variant}
              mobileIconOnly
              className="h-11 w-11 min-h-11 rounded-[16px] p-0 text-xs md:h-auto md:w-auto md:min-h-11 md:rounded-[14px] md:px-4 md:py-2.5 md:text-sm"
            />
          ) : null}
          {profile?.phone ? (
            <HeroActionButton
              href={`tel:${profile.phone}`}
              icon={Phone}
              label="Call"
              variant={variant}
              mobileIconOnly
              className="h-11 w-11 min-h-11 rounded-[16px] p-0 text-xs md:h-auto md:w-auto md:min-h-11 md:rounded-[14px] md:px-4 md:py-2.5 md:text-sm"
            />
          ) : null}
          {canMessageDirectly ? (
            <button
              type="button"
              onClick={handleMessage}
              disabled={messageLoading}
              aria-label={messageLoading ? "Opening message" : "Message"}
              title={messageLoading ? "Opening message" : "Message"}
              className="inline-flex h-11 w-11 min-h-11 shrink-0 items-center justify-center rounded-[16px] border border-slate-200 bg-white p-0 text-slate-700 shadow-sm transition hover:border-[#c8b9ff] hover:bg-[#f8f5ff] hover:text-[#5b37d6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8b9ff] focus-visible:ring-offset-2 disabled:opacity-70 md:hidden"
            >
              {messageLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageCircle className="h-4 w-4" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGuestMessageIntent}
              aria-label="Sign in to message"
              title="Sign in to message"
              className="inline-flex h-11 w-11 min-h-11 shrink-0 items-center justify-center rounded-[16px] border border-slate-200 bg-white p-0 text-slate-700 shadow-sm transition hover:border-[#c8b9ff] hover:bg-[#f8f5ff] hover:text-[#5b37d6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8b9ff] focus-visible:ring-offset-2 md:hidden"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
          )}
          {showSaveBusinessButton ? (
            <SaveBusinessButton
              business={{
                id: saveBusinessId,
                public_id: profile?.public_id || null,
              }}
              isSaved={isBusinessSaved}
              loading={savingBusinessIds.has(saveBusinessId)}
              onToggle={toggleSavedBusiness}
              variant="hero"
              className="h-11 w-11 rounded-[16px] border border-slate-200 bg-white p-0 shadow-sm ring-0 md:rounded-[14px]"
            />
          ) : null}
          <HeroActionIconButton
            icon={Share2}
            label={copied ? "Copied" : "Share"}
            onClick={handleShare}
            variant={variant}
          />
        </div>

        {canMessageDirectly ? (
          <button
            type="button"
            onClick={handleMessage}
            disabled={messageLoading}
            className="hidden min-h-8 items-center justify-center gap-2 self-center rounded-full px-2 text-center text-sm font-medium text-slate-500/90 transition hover:text-[#5b37d6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8b9ff] focus-visible:ring-offset-2 disabled:opacity-70 md:inline-flex md:self-auto lg:self-end"
          >
            <MessageCircle className="h-4 w-4 text-slate-500/80" />
            {messageLoading ? "Opening..." : "Message"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleGuestMessageIntent}
            className="hidden min-h-8 items-center justify-center gap-2 self-center rounded-full px-2 text-center text-sm font-medium text-slate-500/90 transition hover:text-[#5b37d6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8b9ff] focus-visible:ring-offset-2 md:inline-flex md:self-auto lg:self-end"
          >
            <MessageCircle className="h-4 w-4 text-slate-500/80" />
            Sign in to message
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cx("flex w-full flex-col sm:w-auto", variant === "elevated" ? "gap-2" : "gap-3")}>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        {directions ? (
          <HeroActionButton
            href={directions}
            icon={MapPin}
            label="Directions"
            tone="primary"
            variant={variant}
          />
        ) : null}
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:grid-cols-none sm:flex-wrap">
          {website ? (
            <HeroActionButton
              href={website}
              icon={Globe}
              label="Website"
              variant={variant}
            />
          ) : null}
          {profile?.phone ? (
            <HeroActionButton
              href={`tel:${profile.phone}`}
              icon={Phone}
              label="Call"
              variant={variant}
            />
          ) : null}
          {showSaveBusinessButton ? (
            <SaveBusinessButton
              business={{
                id: saveBusinessId,
                public_id: profile?.public_id || null,
              }}
              isSaved={isBusinessSaved}
              loading={savingBusinessIds.has(saveBusinessId)}
              onToggle={toggleSavedBusiness}
              variant={variant === "elevated" ? "hero" : "default"}
              className="justify-self-end"
            />
          ) : null}
        </div>
      </div>

      <div className={cx("flex w-full items-center sm:justify-end", variant === "elevated" ? "gap-2" : "gap-3")}>
        {viewerMode === "owner" && ownerPrimaryAction ? (
          variant === "elevated" ? (
            <HeroActionButton
              icon={ownerPrimaryAction.icon}
              label={ownerPrimaryAction.label}
              onClick={ownerPrimaryAction.onClick}
              tone="primary"
              variant={variant}
            />
          ) : (
            <button
              type="button"
              onClick={ownerPrimaryAction.onClick}
              className={inlineActionClassName}
            >
              {ownerPrimaryAction.label}
            </button>
          )
        ) : canMessageDirectly ? (
          <button
            type="button"
            onClick={handleMessage}
            disabled={messageLoading}
            className={cx(inlineActionClassName, "disabled:opacity-70")}
          >
            {variant === "elevated" ? <MessageCircle className="h-4 w-4" /> : null}
            {messageLoading ? "Opening..." : "Message"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleGuestMessageIntent}
            className={inlineActionClassName}
          >
            {variant === "elevated" ? <MessageCircle className="h-4 w-4" /> : null}
            Sign in to message
          </button>
        )}

        <div className="ml-auto sm:ml-0">
          <HeroActionIconButton
            icon={Share2}
            label={copied ? "Copied" : "Share"}
            onClick={handleShare}
            variant={variant}
          />
        </div>
      </div>
    </div>
  );
}

function PreviewHeroCard({
  profile,
  ratingSummary,
  publicPath,
  name,
  businessType,
  location,
  avatarImage,
  viewerMode = "public",
  ownerPrimaryAction = null,
  ownerSecondaryActions = [],
  editMode = false,
  onAvatarUpload,
  uploading,
  variant = "default",
}) {
  const isElevated = variant === "elevated";
  const isCoverIntegrated = variant === "coverIntegrated";
  const description = String(profile?.description || "").trim();
  const headerDescription =
    isElevated && description && description.length <= 150 ? description : "";
  const actionsVariant = isCoverIntegrated ? "elevated" : variant;

  return (
    <div
      className={cx(
        isCoverIntegrated
          ? "absolute inset-x-0 top-44 z-10 px-5 pb-0 sm:top-40 sm:px-6 md:bottom-0 md:top-auto md:px-4 md:pb-6 lg:px-8"
          : "relative z-10 px-4 sm:px-6 lg:px-8",
        isElevated ? "mx-auto -mt-12 max-w-[1180px] sm:-mt-14 lg:-mt-[4.25rem]" : "",
        !isElevated && !isCoverIntegrated ? "-mt-10 sm:-mt-14" : ""
      )}
    >
      <div
        className={cx(
          isCoverIntegrated ? "mx-auto max-w-[1180px]" : "bg-white/96 backdrop-blur",
          isElevated
            ? "rounded-t-[20px] rounded-b-none border border-b-0 border-slate-200/85 p-4 shadow-[0_20px_50px_-46px_rgba(15,23,42,0.4)] sm:p-5 lg:p-6"
            : isCoverIntegrated
              ? "p-0"
            : "rounded-[28px] border border-slate-200/90 p-4 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.4)] backdrop-blur sm:p-5 lg:p-6"
        )}
      >
        {isCoverIntegrated ? (
          <div
            className="relative flex flex-col px-0 pb-1 md:hidden"
            data-testid="profile-hero-mobile-identity"
          >
            <div
              className="pointer-events-none absolute -inset-x-6 -top-7 h-[132px] rounded-[999px] bg-[radial-gradient(ellipse_at_38%_56%,rgba(255,252,246,0.88)_0%,rgba(255,252,246,0.72)_38%,rgba(255,252,246,0.32)_66%,rgba(255,252,246,0)_100%)] blur-[10px]"
              aria-hidden="true"
            />
            <div className="relative z-10 flex items-end gap-3.5 text-left">
              <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-[24px] border border-white bg-slate-100 shadow-[0_18px_42px_-26px_rgba(15,23,42,0.55)] ring-1 ring-slate-200/90">
                <BusinessAvatarSurface
                  business={profile}
                  avatar={avatarImage}
                  alt={`${name} logo`}
                  sizes="88px"
                  priority
                  compact={false}
                  variant="wordmark"
                />
                {viewerMode === "owner" && editMode && onAvatarUpload ? (
                  <label className="absolute bottom-2 right-2 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white bg-white text-slate-700 shadow">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        onAvatarUpload(file);
                      }}
                      disabled={uploading?.avatar}
                    />
                    {uploading?.avatar ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Pencil className="h-4 w-4" />
                    )}
                  </label>
                ) : null}
              </div>
              <div className="min-w-0 flex-1 pb-2">
                <h1 className="max-w-full text-[1.82rem] font-semibold leading-[0.98] tracking-[-0.04em] text-slate-950 drop-shadow-[0_1px_0_rgba(255,255,255,0.58)] [text-wrap:balance] min-[390px]:text-[2rem]">
                  {name}
                </h1>
                <div className="[&>div:first-child]:mt-2 [&>div:first-child]:gap-x-2.5 [&>div:first-child]:gap-y-1 [&>div:first-child]:text-[13px] [&>div:first-child]:font-medium [&>div:first-child]:leading-none [&>div:first-child]:text-slate-700 [&>div:first-child]:drop-shadow-[0_1px_0_rgba(255,255,255,0.6)] [&>div:first-child>*+*]:border-l [&>div:first-child>*+*]:border-slate-300/90 [&>div:first-child>*+*]:pl-2.5 [&>div:first-child_svg]:h-[18px] [&>div:first-child_svg]:w-[18px] [&>div:last-child]:hidden">
                  <HeroMetadata
                    location={location}
                    ratingSummary={ratingSummary}
                    businessType={null}
                    profile={profile}
                  />
                </div>
                {headerDescription ? (
                  <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">
                    {headerDescription}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-5 w-full">
              <HeroPreviewActions
                profile={profile}
                publicPath={publicPath}
                viewerMode={viewerMode}
                ownerPrimaryAction={ownerPrimaryAction}
                ownerSecondaryActions={ownerSecondaryActions}
                variant={actionsVariant}
              />
            </div>
          </div>
        ) : null}

        <div
          className={cx("flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between", isCoverIntegrated ? "hidden md:flex lg:gap-8" : "")}
          data-testid={isCoverIntegrated ? "profile-hero-desktop-identity" : undefined}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center lg:min-w-0 lg:flex-1">
            <div
              className={cx(
                "relative shrink-0 overflow-hidden border border-white bg-slate-100 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.38)]",
                isCoverIntegrated
                  ? "h-20 w-20 rounded-[20px] shadow-[0_18px_42px_-26px_rgba(15,23,42,0.55)] ring-1 ring-white/80 sm:h-24 sm:w-24"
                  : isElevated
                    ? "h-[5.5rem] w-[5.5rem] rounded-[20px] shadow-[0_18px_38px_-30px_rgba(15,23,42,0.5)] ring-1 ring-slate-200/80 sm:h-24 sm:w-24 lg:h-[6.5rem] lg:w-[6.5rem]"
                    : "h-20 w-20 rounded-[26px] sm:h-24 sm:w-24"
              )}
            >
              <BusinessAvatarSurface
                business={profile}
                avatar={avatarImage}
                alt={`${name} logo`}
                sizes={isCoverIntegrated ? "108px" : isElevated ? "104px" : "96px"}
                priority
                compact={!isCoverIntegrated}
                variant={isCoverIntegrated ? "wordmark" : "avatar"}
              />
              {viewerMode === "owner" && editMode && onAvatarUpload ? (
                <label className="absolute bottom-2 right-2 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white bg-white text-slate-700 shadow">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      onAvatarUpload(file);
                    }}
                    disabled={uploading?.avatar}
                  />
                  {uploading?.avatar ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Pencil className="h-4 w-4" />
                  )}
                </label>
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              {isElevated && businessType ? (
                <p
                  className={cx(
                    "mb-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium leading-none text-[#5b37d6]",
                    "border-[#e6ddff] bg-[#f7f3ff]"
                  )}
                >
                  {businessType}
                </p>
              ) : null}
              <h1
                className={cx(
                  "font-semibold tracking-[-0.035em] text-slate-950",
                  isCoverIntegrated
                    ? "max-w-[20ch] text-[1.9rem] leading-[1.02] drop-shadow-[0_1px_0_rgba(255,255,255,0.4)] sm:text-[2.35rem] lg:text-[2.55rem]"
                    : isElevated
                      ? "max-w-[20ch] text-[1.75rem] leading-[1.05] sm:text-[2.15rem] lg:text-[2.35rem]"
                      : "text-[1.9rem] sm:text-[2.35rem]"
                )}
              >
                {name}
              </h1>
              <HeroMetadata
                location={location}
                ratingSummary={ratingSummary}
                businessType={isElevated || isCoverIntegrated ? null : businessType}
                profile={profile}
              />
              {headerDescription ? (
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-[15px]">
                  {headerDescription}
                </p>
              ) : null}
            </div>
          </div>

          <div
            className={cx(
              "w-full lg:w-auto lg:max-w-[440px]",
              isCoverIntegrated ? "lg:w-fit lg:max-w-none lg:self-end" : ""
            )}
          >
            <HeroPreviewActions
              profile={profile}
              publicPath={publicPath}
              viewerMode={viewerMode}
              ownerPrimaryAction={ownerPrimaryAction}
              ownerSecondaryActions={ownerSecondaryActions}
              variant={actionsVariant}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProfileHero({
  profile,
  ratingSummary,
  mode = "preview",
  viewerMode = "public",
  publicPath,
  backHref,
  primaryAction,
  ownerPrimaryAction,
  ownerSecondaryActions,
  onAvatarUpload,
  onCoverUpload,
  uploading,
  editMode = false,
  variant = "default",
  navItems = null,
}) {
  const { name, businessType, location, avatarImage, coverSrc } =
    useMemo(() => getProfileIdentity(profile), [profile]);

  const topActionClasses =
    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition";
  const isPreview = mode === "preview";
  const isPublicFullBleed = variant === "publicFullBleed" && isPreview;
  const coverSource = coverSrc ? "uploaded" : "defaultFallback";

  return (
    <section
      className={cx(
        isPublicFullBleed ? "mb-0" : "mb-6",
        isPreview && !isPublicFullBleed ? "lg:mb-8" : "",
        isPublicFullBleed ? "relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen text-slate-950" : ""
      )}
    >
      <div
        className={cx(
          isPublicFullBleed ? "bg-[#f8fafc]" : "bg-white",
          isPublicFullBleed
            ? "overflow-visible shadow-none"
            : "overflow-hidden rounded-[34px] border border-slate-200 shadow-[0_32px_80px_-48px_rgba(15,23,42,0.4)]"
        )}
      >
        <div
          data-testid="profile-hero-cover"
          data-business-cover-source={coverSource}
          className={cx(
            "relative overflow-hidden",
            isPublicFullBleed
              ? "h-[360px] sm:h-[320px] md:h-[300px] lg:h-[260px] xl:h-[280px]"
              : isPreview
                ? "h-[180px] sm:h-[220px] lg:h-[250px]"
                : "h-[220px] sm:h-[260px] lg:h-[300px]"
            )}
        >
          {!isPublicFullBleed ? (
            <div
              className={cx(
                "absolute inset-0",
                isPreview
                  ? "bg-[linear-gradient(180deg,rgba(15,23,42,0.08),rgba(15,23,42,0.12)_45%,rgba(15,23,42,0.62)_100%),linear-gradient(120deg,rgba(106,61,240,0.14),rgba(15,23,42,0.1))]"
                  : "bg-[linear-gradient(180deg,rgba(15,23,42,0.16),rgba(15,23,42,0.4)),linear-gradient(120deg,rgba(106,61,240,0.16),rgba(15,23,42,0.08))]"
              )}
            />
          ) : null}
          <BusinessCoverSurface
            business={profile}
            src={coverSrc}
            alt={`${name} cover`}
            sizes="(max-width: 1280px) 100vw, 1200px"
            priority
          />
          {isPublicFullBleed ? (
            coverSource === "defaultFallback" ? (
              <>
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.06)_0%,rgba(15,23,42,0)_38%,rgba(248,250,252,0.08)_62%,rgba(248,250,252,0.46)_89%,rgba(248,250,252,0.68)_100%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(248,250,252,0.18)_0%,rgba(248,250,252,0.1)_26%,rgba(248,250,252,0.02)_60%,rgba(248,250,252,0.08)_100%)]" />
                <div className="absolute inset-x-0 bottom-0 h-[52%] bg-[radial-gradient(ellipse_at_28%_82%,rgba(248,250,252,0.54)_0%,rgba(248,250,252,0.28)_36%,rgba(248,250,252,0)_74%)]" />
                <div className="absolute bottom-0 left-0 h-[62%] w-[68%] bg-[radial-gradient(ellipse_at_30%_78%,rgba(248,250,252,0.72)_0%,rgba(248,250,252,0.52)_32%,rgba(248,250,252,0.18)_58%,rgba(248,250,252,0)_82%)]" />
              </>
            ) : (
              <>
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.12)_0%,rgba(15,23,42,0.01)_34%,rgba(248,250,252,0.12)_58%,rgba(248,250,252,0.66)_86%,rgba(248,250,252,0.88)_100%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(248,250,252,0.44)_0%,rgba(248,250,252,0.25)_24%,rgba(248,250,252,0.04)_58%,rgba(248,250,252,0.16)_100%)]" />
                <div className="absolute inset-x-0 bottom-0 h-[56%] bg-[radial-gradient(ellipse_at_28%_82%,rgba(248,250,252,0.7)_0%,rgba(248,250,252,0.38)_36%,rgba(248,250,252,0)_74%)]" />
                <div className="absolute bottom-0 left-0 h-[62%] w-[68%] bg-[radial-gradient(ellipse_at_30%_78%,rgba(248,250,252,0.78)_0%,rgba(248,250,252,0.56)_32%,rgba(248,250,252,0.2)_58%,rgba(248,250,252,0)_82%)]" />
              </>
            )
          ) : null}

          <div className={cx("absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 sm:p-6", isPublicFullBleed ? "mx-auto max-w-[1180px] lg:px-8" : "")}>
            {backHref ? (
              <Link
                href={backHref}
                className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/85 px-4 py-2 text-sm font-medium text-slate-900 backdrop-blur transition hover:bg-white"
              >
                Back to business profile
              </Link>
            ) : (
              <span />
            )}

            {editMode && onCoverUpload ? (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/40 bg-white/85 px-4 py-2 text-sm font-medium text-slate-900 backdrop-blur transition hover:bg-white">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    onCoverUpload(file);
                  }}
                  disabled={uploading?.cover}
                />
                {uploading?.cover ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Pencil className="h-4 w-4" />
                )}
                Cover photo
              </label>
            ) : null}
          </div>

          {isPublicFullBleed && isPreview ? (
            <PreviewHeroCard
              profile={profile}
              ratingSummary={ratingSummary}
              publicPath={publicPath}
              name={name}
              businessType={businessType}
              location={location}
              avatarImage={avatarImage}
              viewerMode={viewerMode}
              ownerPrimaryAction={ownerPrimaryAction}
              ownerSecondaryActions={ownerSecondaryActions}
              editMode={editMode}
              onAvatarUpload={onAvatarUpload}
              uploading={uploading}
              variant="coverIntegrated"
            />
          ) : null}
        </div>

        {isPreview ? (
          <>
            {!isPublicFullBleed ? (
              <PreviewHeroCard
                profile={profile}
                ratingSummary={ratingSummary}
                publicPath={publicPath}
                name={name}
                businessType={businessType}
                location={location}
                avatarImage={avatarImage}
                viewerMode={viewerMode}
                ownerPrimaryAction={ownerPrimaryAction}
                ownerSecondaryActions={ownerSecondaryActions}
                editMode={editMode}
                onAvatarUpload={onAvatarUpload}
                uploading={uploading}
                variant="default"
              />
            ) : null}
            {isPublicFullBleed && Array.isArray(navItems) && navItems.length ? (
              <ProfileSectionNav items={navItems} attached />
            ) : null}
          </>
        ) : (
          <div className="relative bg-white px-5 pb-5 pt-0 sm:px-6 lg:px-8">
            <div className="-mt-8 flex flex-col gap-4 lg:-mt-10 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="relative h-24 w-24 overflow-hidden rounded-[28px] border border-white bg-slate-100 shadow-[0_20px_40px_-24px_rgba(15,23,42,0.45)] sm:h-28 sm:w-28">
                  <BusinessAvatarSurface
                    business={profile}
                    avatar={avatarImage}
                    alt={`${name} logo`}
                    sizes="112px"
                    priority
                    variant="wordmark"
                  />
                  {editMode && onAvatarUpload ? (
                    <label className="absolute bottom-2 right-2 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white bg-white text-slate-700 shadow">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          onAvatarUpload(file);
                        }}
                        disabled={uploading?.avatar}
                      />
                      {uploading?.avatar ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Pencil className="h-4 w-4" />
                      )}
                    </label>
                  ) : null}
                </div>

                <div className="pb-0.5 lg:pr-4">
                  <h1 className="max-w-[12ch] text-[2rem] font-semibold tracking-[-0.045em] text-slate-950 sm:text-[2.5rem]">
                    {name}
                  </h1>
                  <HeroMetadata
                    location={location}
                    ratingSummary={ratingSummary}
                    businessType={businessType}
                    profile={profile}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:max-w-[320px] lg:justify-end">
                {primaryAction ? (
                  <button
                    type="button"
                    onClick={primaryAction.onClick}
                    className={cx(
                      topActionClasses,
                      "dashboard-primary-action bg-[#6E34FF] text-white hover:bg-[#5E2DE0]"
                    )}
                  >
                    {primaryAction.label}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
