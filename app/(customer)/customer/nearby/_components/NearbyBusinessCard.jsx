"use client";

import FastImage from "@/components/FastImage";
import { resolveBusinessImageSrc } from "@/lib/placeholders/businessPlaceholders";
import { Heart } from "lucide-react";

const formatDistance = (distanceKm) => {
  if (typeof distanceKm !== "number" || !Number.isFinite(distanceKm)) return null;
  const miles = distanceKm * 0.621371;
  if (!Number.isFinite(miles)) return null;
  if (miles < 0.1) return "Nearby";
  return `${miles.toFixed(1)} mi`;
};

const formatLocationLine = (business) => {
  const neighborhood = (business?.neighborhood || business?.district || "").trim();
  const city = (business?.city || "").trim();
  const state = (business?.state || business?.state_code || "").trim();
  if (neighborhood && city) return `${neighborhood}, ${city}`;
  if (city && state) return `${city}, ${state}`;
  return city || neighborhood || state || null;
};

const getHookLine = (business, locationLine) => {
  const category = business?.categoryLabel || business?.category || "Local business";
  const city = (business?.city || "").trim();
  const rawHook = typeof business?.hookLine === "string" ? business.hookLine.trim() : "";
  if (business?.isNew || rawHook === "New on YourBarrio") {
    return "✨ Just added · Be the first to explore";
  }
  if (business?.isVerified || rawHook === "Verified local business") {
    return "✓ Verified · Trusted local shop";
  }
  if (rawHook) return rawHook;
  if (city) return `${category} in ${city}`;
  if (locationLine) return `${category} near ${locationLine}`;
  return `Discover this ${category.toLowerCase()} on YourBarrio`;
};

export default function NearbyBusinessCard({
  business,
  isMobile = false,
  active,
  selected,
  onHover,
  onLeave,
  onClick,
  onMapFocusClick,
  onToggleSave,
  isSaved = false,
  saveLoading = false,
  registerCard,
}) {
  const distanceLabel = formatDistance(business.distance_km ?? business.distanceKm ?? null);
  const locationLine = formatLocationLine(business);
  const hookLine = getHookLine(business, locationLine);
  const categoryLabel = business.categoryLabel || business.category || "Local spot";
  const metadataItems = [categoryLabel, locationLine, distanceLabel].filter(Boolean);
  const photo = resolveBusinessImageSrc({
    imageUrl:
      business?.imageUrl ||
      business?.profile_photo_url ||
      business?.photo_url ||
      business?.image_url ||
      business?.avatar_url ||
      business?.logo_url ||
      null,
    businessType: business?.business_type,
    legacyCategory: business?.categoryLabel || business?.category,
  });

  return (
    <article
      ref={(node) => registerCard(business.id, node)}
      data-business-id={business.id}
      data-selected={selected ? "true" : "false"}
      className={`group relative w-full overflow-hidden rounded-3xl border transition duration-200 focus-within:ring-2 focus-within:ring-violet-400/70 md:hover:-translate-y-0.5 ${
        selected
          ? "border-violet-300 bg-violet-50 shadow-[0_18px_50px_rgba(124,58,237,0.14)]"
          : active
            ? "border-violet-200 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.10)]"
            : "border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.06)] hover:border-violet-200 hover:shadow-[0_18px_48px_rgba(15,23,42,0.11)]"
      }`}
      onMouseEnter={() => onHover(business.id)}
      onMouseLeave={onLeave}
      onFocus={() => onHover(business.id)}
      onBlur={onLeave}
    >
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggleSave?.(business);
        }}
        disabled={saveLoading}
        className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-white/90 text-slate-600 shadow-sm backdrop-blur transition hover:border-rose-200 hover:text-rose-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 disabled:cursor-wait disabled:opacity-70"
        aria-pressed={isSaved}
        aria-label={isSaved ? "Remove saved shop" : "Save shop"}
        title={isSaved ? "Remove saved shop" : "Save shop"}
      >
        <Heart
          className={`h-5 w-5 ${isSaved ? "text-rose-500" : ""}`}
          fill={isSaved ? "currentColor" : "none"}
          aria-hidden="true"
        />
      </button>

      <div className="relative p-3">
        <button
          type="button"
          className="grid w-full min-w-0 gap-3 text-left sm:grid-cols-[160px_minmax(0,1fr)] sm:items-stretch sm:gap-4"
          onClick={() => onClick(business)}
          aria-pressed={selected}
          data-selected={selected ? "true" : "false"}
          aria-label={`Open ${business.name || "business"} profile`}
        >
          <div className="relative h-40 w-full overflow-hidden rounded-2xl border border-slate-100 bg-slate-100 sm:h-36 sm:w-40">
            <FastImage
              src={photo}
              alt={business.name || "Business"}
              fill
              sizes="(max-width: 640px) 100vw, 160px"
              className="object-cover"
              fallbackSrc={photo}
              decoding="async"
            />
          </div>

          <div className="flex min-w-0 flex-col justify-between gap-3 py-0.5 sm:max-w-3xl">
            <div className="min-w-0">
              <div className="min-w-0 space-y-1">
                <h3 className="line-clamp-2 text-lg font-semibold leading-snug tracking-normal text-slate-950 sm:text-xl">
                  {business.name || "Local business"}
                </h3>

                {metadataItems.length ? (
                  <p className="line-clamp-1 text-sm font-medium text-slate-500">
                    {metadataItems.join(" · ")}
                  </p>
                ) : null}
              </div>

              <p className="mt-2 line-clamp-1 text-sm font-semibold text-violet-700">
                {hookLine}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <span
                className="inline-flex min-h-9 items-center justify-center rounded-full bg-violet-500 px-4 text-sm font-semibold shadow-[0_6px_14px_rgba(124,58,237,0.16)] transition group-hover:bg-violet-600 group-hover:shadow-[0_8px_18px_rgba(124,58,237,0.20)] group-focus-visible:bg-violet-600"
                style={{ color: "#fff" }}
              >
                View shop
              </span>
              {typeof business.open_now === "boolean" ? (
                <span className={business.open_now ? "text-xs font-medium text-emerald-700" : "text-xs font-medium text-amber-700"}>
                  {business.open_now ? "Open now" : "Closed"}
                </span>
              ) : null}
            </div>
          </div>
        </button>

        {isMobile ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onMapFocusClick?.(business);
            }}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-violet-200 hover:text-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 sm:absolute sm:bottom-3 sm:right-3 sm:mt-0"
            aria-label={`Show ${business.name || "business"} on map`}
            title="Show on map"
          >
            Show map
          </button>
        ) : null}
      </div>
    </article>
  );
}
