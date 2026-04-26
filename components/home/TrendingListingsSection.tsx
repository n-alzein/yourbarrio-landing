"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
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

function formatPrice(value?: number | string | null): string {
  if (value === null || value === undefined || value === "") return "Price TBD";
  const number = Number(value);
  if (Number.isNaN(number)) return "Price TBD";
  return number.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getDisplayPriceCents(listing: ListingSummary) {
  const finalPriceCents = Number(listing?.finalPriceCents);
  if (Number.isFinite(finalPriceCents) && finalPriceCents > 0) return finalPriceCents;
  return calculateListingPricing(listing?.price).finalPriceCents;
}

function formatPriceCents(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "Price TBD";
  return formatPrice(value / 100);
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
            className="inline-flex items-center justify-center text-sm font-medium text-slate-600 transition-colors duration-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6a4c9340] focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf6f0]"
          >
            View all listings →
          </Link>
        </div>

        <div
          data-testid="homepage-listings-grid"
          className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-3 md:gap-x-4 md:gap-y-6 lg:grid-cols-4 lg:gap-y-6"
        >
          {visibleListings.map((listing, index) => {
            const href =
              mode === "customer" ? getCustomerListingUrl(listing) : getListingUrl(listing);
            const imageSrc =
              resolveListingCoverImageUrl(listing) || getListingCategoryPlaceholder(listing);
            const businessName =
              String(listing?.business_name || "").trim() || "Local business";
            const displayPriceCents = getDisplayPriceCents(listing);
            const displayPrice =
              displayPriceCents > 0 ? formatPriceCents(displayPriceCents) : formatPrice(listing.price);

            return (
              <Link
                key={listing.public_id || listing.id || `${listing.title}-${index}`}
                href={href}
                prefetch={false}
                className="group flex h-full min-w-0 flex-col gap-1 transition-transform duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8c73bb59] focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf6f0] md:gap-1.5"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[20px] bg-white">
                  <Image
                    src={imageSrc}
                    alt={listing.title || "Listing"}
                    fill
                    sizes="(max-width: 767px) calc((100vw - 2rem - 0.75rem) / 2), (max-width: 1023px) calc((100vw - 4rem - 2rem) / 3), calc((100vw - 5rem - 3rem) / 4)"
                    className="object-contain object-center p-1.5 transition-transform duration-200 ease-out group-hover:scale-105 sm:p-2"
                  />
                </div>

                <div className="mt-1 md:mt-1.5">
                  <div className="space-y-0">
                    <p className="whitespace-nowrap text-[15px] font-semibold tracking-[-0.02em] text-slate-950 md:text-base">
                      {displayPrice}
                    </p>
                    <h3 className="line-clamp-2 pt-px text-sm font-medium leading-tight tracking-[-0.01em] text-slate-800">
                      {listing.title || "Untitled listing"}
                    </h3>
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">
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
