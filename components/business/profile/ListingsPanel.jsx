"use client";

import Link from "next/link";
import FastImage from "@/components/FastImage";
import { primaryPhotoUrl } from "@/lib/listingPhotos";

export default function ListingsPanel({ listings, tone }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-lg font-semibold ${tone.textStrong}`}>Listings</h3>
          <p className={`text-sm ${tone.textMuted}`}>Your current offers and featured items.</p>
        </div>
        <Link
          href="/business/listings/new"
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${tone.buttonSecondary}`}
        >
          Create listing
        </Link>
      </div>

      {!listings.length ? (
        <div className={`rounded-xl border ${tone.cardBorder} ${tone.cardSoft} p-6 text-center`}>
          <p className={`text-sm ${tone.textMuted}`}>No listings yet.</p>
          <p className={`text-xs ${tone.textSoft}`}>Add your first listing to appear in search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((listing) => {
            const photo = primaryPhotoUrl(listing.photo_url);
            return (
              <div key={listing.id} className={`rounded-xl border ${tone.cardBorder} ${tone.cardSoft} overflow-hidden`}>
                <div className="h-36 bg-slate-900/40 relative">
                  <FastImage
                    src={photo || "/listing-placeholder.png"}
                    alt={listing.title || "Listing"}
                    className="h-full w-full object-cover"
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    decoding="async"
                  />
                </div>
                <div className="p-4 space-y-1">
                  <p className={`text-sm font-semibold ${tone.textStrong}`}>{listing.title}</p>
                  <p className={`text-xs ${tone.textMuted}`}>{listing.category || "Category"}</p>
                  <p className={`text-sm font-semibold ${tone.textStrong}`}>
                    {listing.price ? `$${listing.price}` : "Price TBD"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
