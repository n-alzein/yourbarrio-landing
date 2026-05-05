"use client";

import { Heart } from "lucide-react";
import { cx } from "@/lib/utils/cx";

export default function SaveBusinessButton({
  business,
  businessId,
  isSaved = false,
  loading = false,
  onToggle,
  className = "",
  variant = "default",
}) {
  const resolvedBusiness = business || (businessId ? { id: businessId } : null);
  const label = isSaved ? "Saved" : "Save business";
  const isHero = variant === "hero";

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle?.(resolvedBusiness);
      }}
      disabled={loading || !resolvedBusiness}
      className={cx(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-slate-600 transition duration-150 hover:scale-[1.03] hover:bg-[#f3efff] hover:text-[#5b37d6] hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8b9ff] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70",
        isHero ? "bg-slate-50/80 shadow-sm ring-1 ring-slate-100" : "bg-white/92 shadow-sm",
        isSaved ? "text-[#6E34FF]" : "",
        className
      )}
      aria-pressed={isSaved}
      aria-label={label}
      title={label}
    >
      <Heart
        className={cx("h-[18px] w-[18px]", isSaved ? "text-[#6E34FF]" : "")}
        fill={isSaved ? "currentColor" : "none"}
        aria-hidden="true"
      />
    </button>
  );
}
