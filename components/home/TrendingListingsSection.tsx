"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Plus } from "lucide-react";
import type { BrowseMode, ListingSummary } from "@/lib/browse/getHomeBrowseData";
import { resolveListingCoverImageUrl } from "@/lib/listingPhotos";
import { getListingCategoryPlaceholder } from "@/lib/taxonomy/placeholders";
import { getCustomerListingUrl, getListingUrl } from "@/lib/ids/publicRefs";
import { sortListingsByAvailability } from "@/lib/inventory";
import HomeSectionContainer from "@/components/home/HomeSectionContainer";
import { calculateListingPricing } from "@/lib/pricing";

type TrendingListingsSectionProps = {
  mode?: BrowseMode;
  listings?: ListingSummary[];
  city?: string | null;
  title?: string;
  subtitle?: string;
  limit?: number;
};

function formatPrice(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return "Price TBD";
  const number = Number(value);
  if (Number.isNaN(number)) return String(value);
  return `$${number.toFixed(2)}`;
}

function getDisplayPriceCents(listing: ListingSummary) {
  const finalPriceCents = Number(listing?.finalPriceCents);
  if (Number.isFinite(finalPriceCents) && finalPriceCents > 0) return finalPriceCents;
  return calculateListingPricing(listing?.price).finalPriceCents;
}

function formatPriceCents(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "Price TBD";
  return `$${(value / 100).toFixed(2)}`;
}

export default function TrendingListingsSection({
  mode = "public",
  listings = [],
  title,
  subtitle,
  limit = 8,
}: TrendingListingsSectionProps) {
  const visibleListings = useMemo(
    () => sortListingsByAvailability(Array.isArray(listings) ? listings : []).slice(0, limit),
    [limit, listings]
  );

  const resolvedTitle = useMemo(() => {
    if (title) return title;
    if (listings.length < 6) {
      return "Recently added in Long Beach";
    }
    return "Popular in Long Beach";
  }, [listings.length, title]);

  const resolvedSubtitle = useMemo(() => {
    if (subtitle) return subtitle;
    return "Local items available near you";
  }, [subtitle]);

  const viewAllHref = "/listings";

  if (!visibleListings.length) return null;

  return (
    <section className="relative z-20 -mt-4 w-full bg-[#fcfcfd] pb-5 pt-5 md:-mt-5 md:pb-6 md:pt-7">
      <HomeSectionContainer className="px-4 sm:px-6 md:px-8">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-[rgba(88,28,135,0.8)]">
              Discover
            </p>
            <h2 className="mt-1 text-[1.55rem] font-semibold tracking-[-0.04em] text-slate-900 sm:text-[1.7rem]">
              {resolvedTitle}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{resolvedSubtitle}</p>
          </div>

          <Link
            href={viewAllHref}
            prefetch={false}
            className="inline-flex h-9 items-center justify-center gap-1 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 shadow-sm transition-colors duration-200 hover:border-slate-300 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6a4c9340] focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf6f0]"
          >
            View all listings
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div
          data-testid="homepage-listings-grid"
          className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4"
        >
          {visibleListings.map((listing, index) => {
            const href =
              mode === "customer" ? getCustomerListingUrl(listing) : getListingUrl(listing);
            const imageSrc =
              resolveListingCoverImageUrl(listing) || getListingCategoryPlaceholder(listing);
            const businessName =
              String(listing?.business_name || "").trim() || "Local business";
            const displayPriceCents = getDisplayPriceCents(listing);

            return (
              <Link
                key={listing.public_id || listing.id || `${listing.title}-${index}`}
                href={href}
                prefetch={false}
                className="group flex h-full min-w-0 flex-col gap-2 transition-transform duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8c73bb59] focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf6f0] md:gap-2.5"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[20px] bg-white">
                  <Image
                    src={imageSrc}
                    alt={listing.title || "Listing"}
                    fill
                    sizes="(max-width: 767px) calc((100vw - 2rem - 0.75rem) / 2), (max-width: 1023px) calc((100vw - 4rem - 2rem) / 3), calc((100vw - 5rem - 3rem) / 4)"
                    className="object-contain object-center p-1.5 transition-transform duration-200 ease-out group-hover:scale-105 sm:p-2"
                  />
                  <span className="pointer-events-none absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-700 opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 md:right-3 md:top-3 md:h-8 md:w-8">
                    <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" aria-hidden="true" />
                  </span>
                </div>

                <div className="flex min-h-[68px] flex-1 flex-col justify-start md:min-h-[74px]">
                  <div className="space-y-0.5">
                    <p className="whitespace-nowrap text-[0.94rem] font-semibold tracking-[-0.03em] text-slate-950 md:text-[1.02rem]">
                      {displayPriceCents > 0
                        ? formatPriceCents(displayPriceCents)
                        : formatPrice(listing.price)}
                    </p>
                    <h3 className="line-clamp-2 min-h-[2rem] text-[0.82rem] font-medium leading-[1.25] tracking-[-0.01em] text-slate-700 md:min-h-[2.2rem] md:text-[0.9rem]">
                      {listing.title || "Untitled listing"}
                    </h3>
                    <p className="line-clamp-1 text-[11px] text-slate-500 md:text-[11.5px]">
                      {businessName}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </HomeSectionContainer>
    </section>
  );
}
