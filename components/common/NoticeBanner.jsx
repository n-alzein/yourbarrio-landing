"use client";

import Link from "next/link";
import { X } from "lucide-react";

const variantClasses = {
  info: "border-slate-200 bg-white text-slate-900",
  success: "border-emerald-100 bg-emerald-50/80 text-slate-900",
  warning: "border-amber-100 bg-amber-50/80 text-slate-900",
  critical: "border-rose-200 bg-rose-50 text-rose-950",
  profile: "border-violet-100 bg-violet-50/80 text-slate-950",
  verification: "border-sky-100 bg-sky-50/80 text-slate-950",
};

const ctaClasses = {
  critical: "text-rose-700 hover:text-rose-800 focus-visible:ring-rose-500/25",
  default: "text-violet-700 hover:text-violet-800 focus-visible:ring-violet-500/25",
};

export default function NoticeBanner({
  id,
  variant = "info",
  title = "",
  message,
  mobileTitle = "",
  mobileMessage = "",
  mobileCtaLabel = "",
  ctaLabel = "",
  ctaHref = "",
  onCtaClick,
  dismissible = false,
  onDismiss,
  icon = null,
  sticky = false,
}) {
  if (!message) return null;

  const className = variantClasses[variant] || variantClasses.info;
  const ctaClassName = ctaClasses[variant] || ctaClasses.default;
  const ctaBaseClassName = `inline-flex shrink-0 items-center text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 ${ctaClassName}`;
  const positionClassName = sticky
    ? "sticky top-[var(--yb-nav-content-offset,80px)] z-30"
    : "";
  const compactTitle = mobileTitle || title;
  const compactMessage = mobileMessage || message;
  const compactCtaLabel = mobileCtaLabel || ctaLabel;

  const renderCta = (label, className = ctaBaseClassName) => label ? (
    ctaHref ? (
      <Link href={ctaHref} onClick={onCtaClick} className={className}>
        {label}
      </Link>
    ) : (
      <button type="button" onClick={onCtaClick} className={className}>
        {label}
      </button>
    )
  ) : null;

  const desktopCta = renderCta(ctaLabel);
  const mobileCta = renderCta(compactCtaLabel, `${ctaBaseClassName} min-h-8`);

  return (
    <div
      data-notice-id={id}
      data-sticky={sticky ? "true" : "false"}
      className={`border-b ${positionClassName} ${className}`}
      role={variant === "critical" ? "alert" : "status"}
    >
      <div className="mx-auto flex min-h-12 w-full max-w-[1380px] items-start gap-3 px-4 py-2 text-left sm:items-center sm:px-6 sm:py-2.5 lg:px-7 xl:px-8">
        {icon ? <span className="shrink-0 text-violet-700">{icon}</span> : null}
        <div className="min-w-0 flex-1 text-sm leading-5">
          <div className="hidden flex-wrap items-center gap-x-2 gap-y-1 sm:flex">
            {title ? <span className="font-semibold">{title}</span> : null}
            {title ? <span className="text-slate-300" aria-hidden="true">—</span> : null}
            <span className="text-slate-600">{message}</span>
            {desktopCta ? <span>{desktopCta}</span> : null}
          </div>

          <div className="flex flex-col gap-1.5 sm:hidden">
            {compactTitle ? (
              <span className="min-w-0 truncate text-sm font-semibold leading-5">
                {compactTitle}
              </span>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm leading-5">
              <span className="text-slate-600">{compactMessage}</span>
              {mobileCta ? <span>{mobileCta}</span> : null}
            </div>
          </div>
        </div>
        {dismissible ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss notice"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/70 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/25"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
