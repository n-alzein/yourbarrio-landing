"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
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
import { installNetTrace } from "@/lib/netTrace";
import { resolveCategoryIdByName } from "@/lib/categories";

export default function ListingsClient() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { theme, hydrated } = useTheme();
  const isLight = hydrated ? theme === "light" : true;
  const category = searchParams.get("category")?.trim();
  const searchTerm = searchParams.get("q")?.trim();
  const showListView = Boolean(category);
  const cacheKey = `${category || "all"}::${searchTerm || "all"}`;
  const sortedListings = useMemo(
    () => sortListingsByAvailability(listings),
    [listings]
  );
  const didInitTraceRef = useRef(false);
  const loggedErrorRef = useRef(null);

  useEffect(() => {
    if (didInitTraceRef.current) return;
    didInitTraceRef.current = true;
    if (process.env.NEXT_PUBLIC_LISTINGS_NETTRACE === "1") {
      installNetTrace({ enabled: true, tag: "LISTINGS" });
      const onError = (event) => {
        console.error("[LISTINGS][window:error]", {
          message: event?.message,
          filename: event?.filename,
          lineno: event?.lineno,
          colno: event?.colno,
          error: event?.error?.stack || event?.error,
        });
      };
      const onUnhandled = (event) => {
        console.error("[LISTINGS][window:unhandledrejection]", {
          reason: event?.reason?.stack || event?.reason,
        });
      };
      window.addEventListener("error", onError);
      window.addEventListener("unhandledrejection", onUnhandled);
      return () => {
        window.removeEventListener("error", onError);
        window.removeEventListener("unhandledrejection", onUnhandled);
      };
    }
    return undefined;
  }, []);
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
    const client = getSupabaseBrowserClient();
    if (!client) {
      setListings([]);
      setLoading(false);
      return undefined;
    }
    let active = true;
    const controller = new AbortController();

    async function getListingsSafe({ signal }) {
      try {
        let query = client
          .from("listings")
          .select("*, category_info:business_categories(name,slug)")
          .order("created_at", { ascending: false });
        if (category) {
          const categoryId = await resolveCategoryIdByName(client, category);
          if (categoryId) {
            query = query.eq("category_id", categoryId);
          } else {
            query = query.ilike("category", category);
          }
        }
        if (searchTerm) {
          const escaped = searchTerm.replace(/,/g, "");
          query = query.or(
            `title.ilike.%${escaped}%,description.ilike.%${escaped}%`
          );
        }
        if (typeof query.abortSignal === "function") {
          query = query.abortSignal(signal);
        }
        const { data, error } = await query;
        if (error) {
          return { ok: false, error, status: error?.status };
        }
        return { ok: true, data: Array.isArray(data) ? data : [] };
      } catch (error) {
        const message = typeof error?.message === "string" ? error.message : "";
        const isAbort =
          error?.name === "AbortError" || message.toLowerCase().includes("aborted");
        if (isAbort) {
          return { ok: false, aborted: true, error };
        }
        return { ok: false, error };
      }
    }

    async function load() {
      setLoading((prev) => (hasLoaded ? prev : true));
      setLoadError(null);
      try {
        const result = await getListingsSafe({ signal: controller.signal });
        if (!active) return;
        if (!result.ok) {
          if (result.aborted) return;
          const requestKey = `${category || "all"}::${searchTerm || "all"}`;
          const session = await client.auth.getSession().catch(() => null);
          const userState = session?.data?.session?.user?.id
            ? "signed_in"
            : "signed_out";
          const loggedKey = loggedErrorRef.current;
          if (loggedKey !== requestKey) {
            loggedErrorRef.current = requestKey;
            console.error("[LISTINGS][load:error]", {
              route: "/listings",
              userState,
              request: "supabase:listings",
              status: result.status,
              message: result.error?.message || "Unknown error",
            });
          }
          setLoadError({
            message:
              result.error?.message || "We couldn't load listings right now.",
          });
          setListings([]);
          return;
        }
        const next = result.data.map((row) => ({
          ...row,
          category: row.category_info?.name || row.category,
        }));
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
      controller.abort();
    };
  }, [category, cacheKey, hasLoaded, retryKey, searchTerm]);

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
          {searchTerm
            ? `Search results for “${searchTerm}”`
            : "Explore listings"}
        </h1>
        {category ? (
          <p className="text-gray-600">
            Category: <span className="font-semibold">{category}</span>
          </p>
        ) : (
          <p className="text-gray-600">Browse all listings.</p>
        )}
      </div>

      {loadError ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <div className="font-semibold">Unable to load listings</div>
          <p className="text-sm mt-1">{loadError.message}</p>
          <button
            type="button"
            onClick={() => setRetryKey((prev) => prev + 1)}
            className="mt-3 inline-flex items-center rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-700"
          >
            Try again
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6">Loading listings...</div>
      ) : null}

      {!loading && !loadError && sortedListings.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-gray-600">
          No listings found. Try a different search.
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        {sortedListings.map((listing) => {
          const inventory = normalizeInventory(listing);
          const availability = getAvailabilityBadgeStyle(inventory);
          return (
            <Link
              key={listing.id}
              href={`/listings/${listing.id}`}
              className="group flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg md:flex-row"
            >
              <div className="relative h-40 w-full flex-shrink-0 overflow-hidden rounded-xl bg-gray-100 md:h-32 md:w-48">
                <SafeImage
                  src={primaryPhotoUrl(listing.photo_url)}
                  alt={listing.title || "Listing photo"}
                  fill
                  className="object-cover transition duration-500 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 192px"
                  onError={() => {}}
                  onLoad={() => {}}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {listing.title || "Untitled listing"}
                  </h2>
                  {availability ? (
                    <span className={availability.className}>{availability.label}</span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                  {listing.description || "No description available."}
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                  <span>{listing.category || "Uncategorized"}</span>
                  <span>•</span>
                  <span>{listing.city || "Your city"}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
