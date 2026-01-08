"use client";

import { useState, useEffect, useMemo } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient";
import Link from "next/link";
import { primaryPhotoUrl } from "@/lib/listingPhotos";
import SafeImage from "@/components/SafeImage";
import { useSearchParams, useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import {
  getAvailabilityBadgeStyle,
  normalizeInventory,
  sortListingsByAvailability,
} from "@/lib/inventory";

export default function PublicListingsPage() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { theme, hydrated } = useTheme();
  const isLight = hydrated ? theme === "light" : true;
  const category = searchParams.get("category")?.trim();
  const showListView = Boolean(category);
  const cacheKey = category
    ? `yb_public_listings_${category.toLowerCase()}`
    : "yb_public_listings_all";
  const sortedListings = useMemo(
    () => sortListingsByAvailability(listings),
    [listings]
  );
  // Hydrate from session cache so the page feels instant on back/forward
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(cacheKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) {
        setListings(parsed);
        setHasLoaded(true);
        setLoading(false);
      }
    } catch {
      // ignore cache errors
    }
  }, [cacheKey]);

  // Safety: don't leave loading true forever
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setLoading(false), 8000);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    const client = getBrowserSupabaseClient();
    if (!client) {
      setListings([]);
      setLoading(false);
      return undefined;
    }
    let active = true;

    async function load() {
      setLoading((prev) => (hasLoaded ? prev : true));
      try {
        let query = client.from("listings").select("*").order("created_at", {
          ascending: false,
        });
        if (category) {
          query = query.ilike("category", category);
        }
        const { data, error } = await query;
        if (error) {
          console.error("Failed to load listings", error);
        }
        if (!active) return;
        const next = Array.isArray(data) ? data : [];
        setListings(next);
        setHasLoaded(true);
        if (typeof window !== "undefined") {
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(next));
          } catch {
            // ignore cache errors
          }
        }
      } catch (err) {
        console.error("Failed to load listings", err);
        if (active) setListings([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [category, cacheKey, hasLoaded]);

  return (
    <div className="max-w-4xl mx-auto py-2 md:pt-1">
      {showListView ? (
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-3 inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition"
        >
          ← Go back
        </button>
      ) : null}
      <div>
        <h1 className="text-3xl font-bold mb-2">
          {category ? `${category} Listings` : "All Listings"}
        </h1>
        {category ? (
          <p className="text-sm text-gray-500 mb-6">
            Showing {listings.length} in {category}
          </p>
        ) : (
          <div className="mb-6" />
        )}
      </div>

      {loading ? (
        <div className="text-gray-500">Loading listings...</div>
      ) : (
        <div
          className={
            showListView
              ? "space-y-5"
              : "grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6"
          }
        >
          {sortedListings.map((item) => {
            const inventory = normalizeInventory(item);
            const badgeStyle = getAvailabilityBadgeStyle(
              inventory.availability,
              isLight
            );
            return (
            <Link key={item.id} href={`/listings/${item.id}`}>
              {showListView ? (
                <div className="rounded-lg border overflow-hidden flex">
                  <SafeImage
                    src={primaryPhotoUrl(item.photo_url)}
                    alt="Listing"
                    width={220}
                    height={160}
                    className="object-cover h-40 w-56"
                    fallbackSrc="/business-placeholder.png"
                  />
                  <div className="p-4 flex-1">
                    <h2 className="font-semibold">{item.title}</h2>
                    {item.category ? (
                      <p className="text-xs uppercase tracking-wide text-gray-500 mt-1">
                        {item.category}
                      </p>
                    ) : null}
                    <span
                      className="mt-2 inline-flex items-center rounded-full border bg-transparent px-2 py-1 text-[11px] font-semibold"
                      style={
                        badgeStyle
                          ? { color: badgeStyle.color, borderColor: badgeStyle.border }
                          : undefined
                      }
                    >
                      {inventory.label}
                    </span>
                    {item.description ? (
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                        {item.description}
                      </p>
                    ) : null}
                    {item.price ? (
                      <p className="text-gray-700 font-medium mt-2">${item.price}</p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <SafeImage
                    src={primaryPhotoUrl(item.photo_url)}
                    alt="Listing"
                    width={400}
                    height={300}
                    className="object-cover h-48 w-full"
                    fallbackSrc="/business-placeholder.png"
                  />
                  <div className="p-4">
                    <h2 className="font-semibold">{item.title}</h2>
                    <span
                      className="mt-2 inline-flex items-center rounded-full border bg-transparent px-2 py-1 text-[11px] font-semibold"
                      style={
                        badgeStyle
                          ? { color: badgeStyle.color, borderColor: badgeStyle.border }
                          : undefined
                      }
                    >
                      {inventory.label}
                    </span>
                    {item.price ? <p className="text-gray-500">${item.price}</p> : null}
                  </div>
                </div>
              )}
            </Link>
          );
          })}
        </div>
      )}
    </div>
  );
}
