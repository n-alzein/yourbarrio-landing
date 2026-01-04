"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient";
import { primaryPhotoUrl } from "@/lib/listingPhotos";
import { useTheme } from "@/components/ThemeProvider";
import SafeImage from "@/components/SafeImage";

export default function BusinessListingsPage() {
  const { supabase, authUser, loadingUser } = useAuth();
  const router = useRouter();
  const { theme, hydrated } = useTheme();
  const isLight = hydrated ? theme === "light" : true;

  const [listings, setListings] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const cached = sessionStorage.getItem("yb_business_listings");
      const parsed = cached ? JSON.parse(cached) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(() => listings.length > 0);
  const [isVisible, setIsVisible] = useState(
    typeof document === "undefined" ? true : !document.hidden
  );
  const totalListings = listings.length;
  const averagePrice =
    totalListings === 0
      ? 0
      : listings.reduce((sum, item) => sum + Number(item.price || 0), 0) /
        totalListings;
  const primaryCategory =
    listings.find((item) => item.category)?.category ?? "Category pending";
  const lastUpdated = listings[0]?.created_at
    ? new Date(listings[0].created_at).toLocaleDateString()
    : "—";
  const showLoading = !hasLoaded && (loadingUser || loading);

  useEffect(() => {
    const handleVisibility = () => setIsVisible(!document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Safety: don't leave loading true forever
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setLoading(false), 8000);
    return () => clearTimeout(timer);
  }, [loading]);

  // ------------------------------------------------------
  //  SAFE AUTH GUARD + FETCH
  // ------------------------------------------------------
  useEffect(() => {
    if (loadingUser) return; // Wait for auth
    if (!authUser) {
      setLoading(false);
      return;
    }
    if (!isVisible) return;
    const client = supabase ?? getBrowserSupabaseClient();

    async function fetchListings() {
      // Only show the loading state if we don't already have data
      setLoading((prev) => (hasLoaded ? prev : true));
      let active = true;
      try {
        const { data, error } = await client
          .from("listings")
          .select("*")
          .eq("business_id", authUser.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("❌ Fetch listings error:", error);
        } else if (active) {
          setListings(data || []);
          setHasLoaded(true);
          try {
            sessionStorage.setItem(
              "yb_business_listings",
              JSON.stringify(data || [])
            );
          } catch {
            // ignore cache write errors
          }
        }
      } catch (err) {
        console.error("❌ Fetch listings error:", err);
      } finally {
        if (active) setLoading(false);
      }

      return () => {
        active = false;
      };
    }

    const cleanup = fetchListings();
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, [loadingUser, authUser, supabase, hasLoaded, isVisible]);

  // ------------------------------------------------------
  // DELETE LISTING
  // ------------------------------------------------------
  async function handleDelete(id) {
    if (!confirm("Are you sure you want to delete this listing?")) return;

    const { error } = await supabase
      .from("listings")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("❌ Delete error:", error);
      alert("Failed to delete listing.");
      return;
    }

    setListings((prev) => prev.filter((l) => l.id !== id));
  }

  // ------------------------------------------------------
  // LOADING STATES
  // ------------------------------------------------------
  if (showLoading) {
    return (
      <p className="text-slate-700 dark:text-slate-100 text-center py-20">
        Loading listings...
      </p>
    );
  }
  if (!authUser) {
    return (
      <p className="text-slate-700 dark:text-slate-100 text-center py-20">
        Loading your account...
      </p>
    );
  }

  // ------------------------------------------------------
  // RENDER
  // ------------------------------------------------------
  return (
    <div className="max-w-6xl mx-auto px-6 py-4 md:py-8 text-slate-900 dark:text-slate-100">
      {/* Hero */}
      <div
        className={`rounded-3xl border shadow-xl p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center gap-8 ${
          isLight
            ? "border-slate-200/70 bg-gradient-to-r from-white via-slate-50 to-white"
            : "border-white/10 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950"
        }`}
      >
        <div className="flex-1">
          <p
            className={`text-sm font-semibold uppercase tracking-wide ${
              isLight ? "text-indigo-800" : "text-indigo-200"
            }`}
          >
            Catalog manager
          </p>
          <h1
            className={`mt-2 text-3xl md:text-4xl font-extrabold leading-tight ${
              isLight ? "text-slate-900" : "text-slate-100"
            }`}
          >
            Your Listings, ready for shoppers
          </h1>
          <p
            className={`mt-3 max-w-2xl ${
              isLight ? "text-slate-700" : "text-slate-300"
            }`}
          >
            Keep your catalog retail-ready with polished imagery, clear pricing, and quick edits. A streamlined workspace inspired by the world’s top marketplaces.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 theme-lock">
            <button
              onClick={() => router.push("/business/listings/new")}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-white font-semibold shadow-lg shadow-indigo-200/60 dark:shadow-indigo-900/40 hover:bg-indigo-700 transition"
            >
              + Create new listing
            </button>
            <button
              onClick={() => router.push("/business/dashboard")}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold transition border ${
                isLight
                  ? "bg-white text-slate-900 border-slate-300 hover:bg-slate-50"
                  : "text-white border-white/15 hover:bg-white/10"
              }`}
            >
              View dashboard
            </button>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-300">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 border shadow-sm ${
                isLight
                  ? "bg-white border-slate-200/80 text-slate-600"
                  : "bg-white/5 border-white/10 text-slate-200"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Live catalog
            </span>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 border shadow-sm ${
                isLight
                  ? "bg-white border-slate-200/80 text-slate-600"
                  : "bg-white/5 border-white/10 text-slate-200"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-sky-500" />
              Inventory ready
            </span>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 border shadow-sm ${
                isLight
                  ? "bg-white border-slate-200/80 text-slate-600"
                  : "bg-white/5 border-white/10 text-slate-200"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Fast edits
            </span>
          </div>
        </div>
        <div className="w-full md:w-64">
          <div
            className={`rounded-2xl border shadow-lg p-4 ${
              isLight ? "bg-white border-slate-200/80" : "bg-slate-900/70 border-white/10"
            }`}
          >
            <div
              className={`text-sm font-semibold ${
                isLight ? "text-slate-700" : "text-slate-300"
              }`}
            >
              Snapshot
            </div>
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between">
                <span
                  className={`text-sm ${
                    isLight ? "text-slate-700" : "text-slate-400"
                  }`}
                >
                  Total listings
                </span>
                <span
                  className={`text-lg font-bold ${
                    isLight ? "text-slate-900" : "text-slate-100"
                  }`}
                >
                  {totalListings}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span
                  className={`text-sm ${
                    isLight ? "text-slate-700" : "text-slate-400"
                  }`}
                >
                  Avg. price
                </span>
                <span
                  className={`text-lg font-bold ${
                    isLight ? "text-slate-900" : "text-slate-100"
                  }`}
                >
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 0,
                  }).format(averagePrice || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span
                  className={`text-sm ${
                    isLight ? "text-slate-700" : "text-slate-400"
                  }`}
                >
                  Lead category
                </span>
                <span
                  className={`text-sm font-semibold ${
                    isLight ? "text-slate-900" : "text-slate-100"
                  }`}
                >
                  {primaryCategory}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span
                  className={`text-sm ${
                    isLight ? "text-slate-700" : "text-slate-400"
                  }`}
                >
                  Last update
                </span>
                <span
                  className={`text-sm font-semibold ${
                    isLight ? "text-slate-900" : "text-slate-100"
                  }`}
                >
                  {lastUpdated}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
        <div
          className={`rounded-2xl border shadow-sm p-4 ${
            isLight ? "bg-white border-slate-200/80" : "bg-slate-900/80 border-white/10"
          }`}
        >
          <div className={`text-sm ${isLight ? "text-slate-700" : "text-slate-400"}`}>
            Catalog health
          </div>
          <div className="mt-2 flex items-end gap-2">
            <span
              className={`text-3xl font-extrabold ${
                isLight ? "text-indigo-800" : "text-indigo-200"
              }`}
            >
              {totalListings > 0 ? "On track" : "Start now"}
            </span>
            {totalListings > 0 && (
              <span className="text-xs text-emerald-600 dark:text-emerald-300 font-semibold">
                ✓ Published
              </span>
            )}
          </div>
          <p className={`mt-2 text-sm ${isLight ? "text-slate-700" : "text-slate-400"}`}>
            Keep your items fresh with current pricing and imagery.
          </p>
        </div>
        <div
          className={`rounded-2xl border shadow-sm p-4 ${
            isLight ? "bg-white border-slate-200/80" : "bg-slate-900/80 border-white/10"
          }`}
        >
          <div className={`text-sm ${isLight ? "text-slate-700" : "text-slate-400"}`}>
            Pricing overview
          </div>
          <div
            className={`mt-2 text-3xl font-extrabold ${
              isLight ? "text-slate-900" : "text-slate-100"
            }`}
          >
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            }).format(averagePrice || 0)}
          </div>
          <p className={`mt-2 text-sm ${isLight ? "text-slate-700" : "text-slate-400"}`}>
            Deliver clear, competitive pricing shoppers expect.
          </p>
        </div>
        <div
          className={`rounded-2xl border shadow-sm p-4 ${
            isLight ? "bg-white border-slate-200/80" : "bg-slate-900/80 border-white/10"
          }`}
        >
          <div className={`text-sm ${isLight ? "text-slate-700" : "text-slate-400"}`}>
            Visibility
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span
              className={`text-lg font-semibold ${
                isLight ? "text-slate-900" : "text-slate-100"
              }`}
            >
              Featured in local search
            </span>
          </div>
          <p className={`mt-2 text-sm ${isLight ? "text-slate-700" : "text-slate-400"}`}>
            Listings appear in neighborhood results for nearby shoppers.
          </p>
        </div>
      </div>

      {/* Empty state */}
      {listings.length === 0 && (
        <div
          className={`mt-12 rounded-3xl border border-dashed p-10 text-center shadow-sm ${
            isLight ? "bg-white border-slate-300/80" : "bg-slate-900/60 border-white/15"
          }`}
        >
          <h2 className="text-2xl font-bold">No listings yet</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            Add your first item to start reaching nearby customers.
          </p>
          <div className="mt-6">
            <button
              onClick={() => router.push("/business/listings/new")}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-white font-semibold shadow-md hover:bg-indigo-700 transition"
            >
              Add your first listing
            </button>
          </div>
        </div>
      )}

      {/* List grid */}
      {listings.length > 0 && (
        <div className="mt-12 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-xl font-bold ${isLight ? "text-slate-900" : "text-slate-100"}`}>
                Catalog
              </h2>
              <p className={`text-sm ${isLight ? "text-slate-700" : "text-slate-400"}`}>
                Manage imagery, categories, and pricing in one place.
              </p>
            </div>
            <button
              onClick={() => router.push("/business/listings/new")}
              className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-slate-300/80 dark:border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white dark:hover:bg-white/10 transition"
            >
              + New listing
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {listings.map((listing) => (
              <div
                key={listing.id}
                className={`group relative overflow-hidden rounded-2xl border shadow-sm hover:shadow-xl transition ${
                  isLight ? "bg-white border-slate-200/80" : "bg-slate-900/80 border-white/10"
                }`}
              >
                {primaryPhotoUrl(listing.photo_url) ? (
                  <div
                    className={`relative h-48 w-full overflow-hidden ${
                      isLight ? "bg-slate-50" : "bg-slate-800"
                    }`}
                  >
                    <SafeImage
                      src={primaryPhotoUrl(listing.photo_url)}
                      alt={listing.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                      fallbackSrc="/business-placeholder.png"
                    />
                  </div>
                ) : (
                  <div className="h-48 w-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                    Image coming soon
                  </div>
                )}

                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p
                        className={`text-xs uppercase tracking-wide ${
                          isLight ? "text-slate-700" : "text-slate-400"
                        }`}
                      >
                        {listing.category || "Uncategorized"}
                      </p>
                      <h3
                        className={`text-lg font-bold leading-snug ${
                          isLight ? "text-slate-900" : "text-slate-100"
                        }`}
                      >
                        {listing.title || "Untitled listing"}
                      </h3>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                        isLight
                          ? "bg-slate-100 text-slate-900 border-slate-200"
                          : "bg-amber-500/20 text-amber-100 border-amber-400/20"
                      }`}
                    >
                      {listing.price
                        ? new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: "USD",
                            maximumFractionDigits: 0,
                          }).format(Number(listing.price))
                        : "Price TBC"}
                    </span>
                  </div>

                  <div
                    className={`flex items-center justify-between text-sm ${
                      isLight ? "text-slate-700" : "text-slate-400"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Ready for customers
                    </span>
                    <span>
                      {listing.created_at
                        ? new Date(listing.created_at).toLocaleDateString()
                        : "—"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      onClick={() =>
                        router.push(`/business/listings/${listing.id}/edit`)
                      }
                      className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                        isLight
                          ? "text-slate-900 border-slate-300 hover:bg-slate-50"
                          : "text-white border-white/15 hover:bg-white/10"
                      }`}
                    >
                      ✏️ Edit details
                    </button>
                    <button
                      onClick={() => handleDelete(listing.id)}
                      className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-rose-700 transition"
                    >
                      🗑 Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
