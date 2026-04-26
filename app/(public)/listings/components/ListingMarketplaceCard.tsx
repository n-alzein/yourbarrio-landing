"use client";

import Link from "next/link";
import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import SafeImage from "@/components/SafeImage";
import { useCart } from "@/components/cart/CartProvider";
import { resolveListingCoverImageUrl } from "@/lib/listingPhotos";
import { getListingUrl } from "@/lib/ids/publicRefs";
import { normalizeInventory } from "@/lib/inventory";
import { calculateListingPricing } from "@/lib/pricing";
import { getSeededListingBadgeLabel, isSeededListing } from "@/lib/seededListings";
import type { ListingItem } from "../types";

function formatPrice(value: ListingItem["price"]) {
  if (value === null || value === undefined || value === "") return "Price TBD";
  const number = Number(value);
  if (Number.isNaN(number)) return String(value);
  return number.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getDisplayPriceCents(listing: ListingItem) {
  const finalPriceCents = Number(listing?.finalPriceCents);
  if (Number.isFinite(finalPriceCents) && finalPriceCents > 0) return finalPriceCents;
  return calculateListingPricing(listing?.price).finalPriceCents;
}

function formatPriceCents(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "Price TBD";
  return formatPrice(value / 100);
}

export default function ListingMarketplaceCard({
  listing,
  fallbackLocationLabel,
}: {
  listing: ListingItem;
  fallbackLocationLabel: string;
}) {
  const { addItem } = useCart();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const inventory = normalizeInventory(listing);
  const seeded = isSeededListing(listing);
  const isOutOfStock = inventory.availability === "out";
  const businessName = String(listing?.business_name || "").trim();
  const listingHref = getListingUrl(listing);
  const displayPriceCents = getDisplayPriceCents(listing);
  void fallbackLocationLabel;
  const addToCartLabel = seeded ? "Coming soon" : adding ? "Adding..." : added ? "Added" : "Add to cart";

  const handleAddToCart = async () => {
    if (!listing?.id || isOutOfStock || seeded || adding) return;
    setAdding(true);
    setAdded(false);
    const result = await addItem({
      listingId: String(listing.id),
      quantity: 1,
      listing,
      business: {
        id: listing.business_id,
        business_name: businessName,
      },
    });
    setAdding(false);
    if (!result?.error) {
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1600);
    }
  };

  return (
    <div className="group flex h-full min-w-0 flex-col rounded-xl border border-slate-100 bg-white transition duration-200 ease-out hover:shadow-sm">
      <Link
        href={listingHref}
        className="flex min-h-0 flex-1 flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8c73bb59] focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf6f0]"
        prefetch={false}
      >
        <div className="relative flex h-[140px] items-center justify-center overflow-hidden md:h-[180px]">
          <SafeImage
            src={resolveListingCoverImageUrl(listing)}
            alt={listing.title || "Listing photo"}
            className="h-full w-full object-contain object-center px-[8%] py-[7%] transition duration-300 ease-out group-hover:scale-[1.02]"
            sizes="(max-width: 767px) 50vw, (max-width: 1023px) 25vw, (max-width: 1439px) 20vw, 19vw"
            onError={() => {}}
            onLoad={() => {}}
          />
          {seeded ? (
            <span className="absolute left-2.5 top-2.5 inline-flex items-center rounded-full border border-slate-300 bg-white/92 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              {getSeededListingBadgeLabel(listing)}
            </span>
          ) : null}
        </div>

        <div className="px-3 pb-3 pt-2.5">
          <div className="space-y-0">
            <p className="whitespace-nowrap text-[15px] font-semibold tracking-[-0.02em] text-slate-950 md:text-base">
              {displayPriceCents > 0 ? formatPriceCents(displayPriceCents) : formatPrice(listing.price)}
            </p>
            <h3 className="line-clamp-2 pt-px text-sm font-medium leading-tight tracking-[-0.01em] text-slate-800">
              {listing.title || "Untitled listing"}
            </h3>
            {businessName ? (
              <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">
                {businessName}
              </p>
            ) : null}
          </div>
        </div>
      </Link>

      <div className="px-3 pb-3 pt-0.5 transition-all duration-200 md:translate-y-1 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100">
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={seeded || isOutOfStock || adding}
          className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8c73bb59] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
        >
          <ShoppingCart className="h-4 w-4 text-current" />
          {addToCartLabel}
        </button>
      </div>
    </div>
  );
}
