"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient";
import { primaryPhotoUrl } from "@/lib/listingPhotos";
import { getLowStockThreshold, normalizeInventory } from "@/lib/inventory";
import { useTheme } from "@/components/ThemeProvider";
import SafeImage from "@/components/SafeImage";
import InventorySelfTest from "@/components/debug/InventorySelfTest";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

export default function BusinessListingsPage() {
  const { supabase, authUser, loadingUser } = useAuth();
  const router = useRouter();
  const { theme, hydrated } = useTheme();
  const isLight = hydrated ? theme === "light" : true;
  const [isHydrating, setIsHydrating] = useState(true);

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
  const [inventoryUpdatingId, setInventoryUpdatingId] = useState(null);
  const inventoryPollRef = useRef(null);
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

  useEffect(() => {
    return () => {
      if (inventoryPollRef.current) {
        clearTimeout(inventoryPollRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setIsHydrating(false);
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

  async function updateListingInventory(listingId, updates) {
    if (!authUser) {
      alert("Connection not ready. Please try again.");
      return;
    }

    const clearPoll = () => {
      if (inventoryPollRef.current) {
        clearTimeout(inventoryPollRef.current);
        inventoryPollRef.current = null;
      }
    };

    clearPoll();
    setInventoryUpdatingId(listingId);
    try {
      const payload = { ...updates };
      const response = await fetchWithTimeout("/api/inventory/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, updates: payload }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to start inventory update.");
      }

      const syncPayload = await response.json();
      const { jobId, listingId: jobListingId } = syncPayload || {};
      if (process.env.NEXT_PUBLIC_DEBUG_PERF === "true") {
        console.info("[inventory] sync response", syncPayload);
      }
      if (!jobId) {
        throw new Error("Inventory update job could not be created.");
      }
      const isValidJobId = /^[0-9a-fA-F-]{36}$/.test(jobId);
      if (!isValidJobId) {
        throw new Error("Inventory update job id is invalid. Please retry.");
      }
      if (jobListingId && jobListingId !== listingId) {
        setInventoryUpdatingId(null);
        alert("Another inventory update is already in progress. Please wait.");
        return;
      }

      try {
        await fetchWithTimeout(`/api/inventory/jobs/${jobId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      } catch (err) {
        console.warn("Inventory job trigger failed, relying on polling.", err);
      }

      const applyInventoryUpdate = (listingUpdate) => {
        setListings((prev) => {
          const next = prev.map((item) =>
            item.id === listingId ? { ...item, ...listingUpdate } : item
          );
          try {
            sessionStorage.setItem("yb_business_listings", JSON.stringify(next));
          } catch {
            // ignore cache write errors
          }
          return next;
        });
      };

      const pollJob = async () => {
        try {
          if (!jobId || !/^[0-9a-fA-F-]{36}$/.test(jobId)) {
            throw new Error("Inventory update job id is missing. Please retry.");
          }
          if (process.env.NEXT_PUBLIC_DEBUG_PERF === "true") {
            console.info("[inventory] polling job", jobId);
          }
          const statusRes = await fetchWithTimeout(
            `/api/inventory/jobs/${jobId}`,
            { method: "GET" }
          );
          if (!statusRes.ok) {
            let errorPayload = null;
            try {
              errorPayload = await statusRes.json();
            } catch {}
            if (errorPayload?.code === "42P01") {
              throw new Error(
                "Inventory jobs table is missing. Please run the latest migration."
              );
            }
            throw new Error(
              errorPayload?.details ||
                errorPayload?.error ||
                "Failed to check job status."
            );
          }

          const payload = await statusRes.json();
          const job = payload?.job || payload;
          if (job?.status === "succeeded") {
            applyInventoryUpdate({
              ...updates,
              inventory_last_updated_at:
                job?.completed_at || new Date().toISOString(),
            });
            setInventoryUpdatingId(null);
            clearPoll();
            return;
          }
          if (job?.status === "failed") {
            throw new Error(job?.error || "Inventory update failed.");
          }
        } catch (err) {
          console.error("❌ Inventory job error:", err);
          alert(err?.message || "Failed to update inventory status.");
          setInventoryUpdatingId(null);
          clearPoll();
          return;
        }

        inventoryPollRef.current = setTimeout(pollJob, 1500);
      };

      pollJob();
    } catch (err) {
      console.error("❌ Update inventory error:", err);
      alert(err?.message || "Failed to update inventory status.");
      clearPoll();
      setInventoryUpdatingId(null);
    }
  }

  const cancelInventoryUpdate = () => {
    if (inventoryPollRef.current) {
      clearTimeout(inventoryPollRef.current);
      inventoryPollRef.current = null;
    }
    setInventoryUpdatingId(null);
  };

  // ------------------------------------------------------
  // LOADING STATES
  // ------------------------------------------------------
  if (isHydrating) {
    return (
      <p className="text-slate-700 dark:text-slate-100 text-center py-20">
        Loading listings...
      </p>
    );
  }
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
      {process.env.NODE_ENV !== "production" ? <InventorySelfTest /> : null}
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-10">
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
        <div className="mt-12 space-y-5">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            {listings.map((listing) => {
              const inventory = normalizeInventory(listing);
              const isUpdating = inventoryUpdatingId === listing.id;
              const threshold = getLowStockThreshold(listing);
              const currentQuantity = Number(listing.inventory_quantity);
              const restockQuantity =
                Number.isFinite(currentQuantity) && currentQuantity > 0
                  ? currentQuantity
                  : Math.max(10, threshold * 2);
              const availabilityPalette = {
                available: {
                  light: { color: "#065f46", border: "#047857" },
                  dark: { color: "#d1fae5", border: "rgba(110, 231, 183, 0.7)" },
                },
                low: {
                  light: { color: "#92400e", border: "#b45309" },
                  dark: { color: "#fef3c7", border: "rgba(252, 211, 77, 0.7)" },
                },
                out: {
                  light: { color: "#9f1239", border: "#be123c" },
                  dark: { color: "#ffe4e6", border: "rgba(251, 113, 133, 0.7)" },
                },
              };
              const badgeStyle = isLight
                ? availabilityPalette[inventory.availability]?.light
                : availabilityPalette[inventory.availability]?.dark;

              return (
                <div
                  key={listing.id}
                  className={`group relative overflow-hidden rounded-2xl border shadow-sm hover:shadow-xl transition ${
                    isLight
                      ? "bg-white border-slate-200/80"
                      : "bg-slate-900/80 border-white/10"
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

                <div className="p-5 space-y-4">
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
                    <div className="flex flex-col items-end gap-2">
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
                      <span
                        className="inline-flex items-center justify-center text-center rounded-full px-3 py-1 text-[11px] font-semibold border bg-transparent"
                        style={
                          badgeStyle
                            ? { color: badgeStyle.color, borderColor: badgeStyle.border }
                            : undefined
                        }
                      >
                        {inventory.label}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div
                      className={`flex items-center justify-between ${
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

                    <div
                      className={`flex items-center justify-between ${
                        isLight ? "text-slate-700" : "text-slate-400"
                      }`}
                    >
                      <span>Inventory available</span>
                      <span className="font-semibold">
                        {listing.inventory_quantity ?? "Not set"}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`pt-3 border-t flex flex-wrap items-center gap-2 ${
                      isLight ? "border-slate-200/80" : "border-white/10"
                    }`}
                  >
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
                    <div className="flex flex-wrap items-center gap-2 ml-auto">
                      <button
                        onClick={() =>
                          updateListingInventory(listing.id, {
                            inventory_status: "out_of_stock",
                            inventory_quantity: 0,
                          })
                        }
                        disabled={isUpdating}
                        className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                          isLight
                            ? "text-slate-900 border-slate-300 hover:bg-slate-50"
                            : "text-white border-white/15 hover:bg-white/10"
                        }`}
                      >
                        {isUpdating ? "Updating..." : "Mark out of stock"}
                      </button>
                      <button
                        onClick={() =>
                          updateListingInventory(listing.id, {
                            inventory_status: "in_stock",
                            inventory_quantity: restockQuantity,
                          })
                        }
                        disabled={isUpdating}
                        className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                          isLight
                            ? "text-slate-900 border-slate-300 hover:bg-slate-50"
                            : "text-white border-white/15 hover:bg-white/10"
                        }`}
                      >
                        {isUpdating ? "Updating..." : "Restock"}
                      </button>
                      <button
                        onClick={() =>
                          updateListingInventory(listing.id, {
                            inventory_status: "seasonal",
                          })
                        }
                        disabled={isUpdating}
                        className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                          isLight
                            ? "text-slate-900 border-slate-300 hover:bg-slate-50"
                            : "text-white border-white/15 hover:bg-white/10"
                        }`}
                      >
                        {isUpdating ? "Updating..." : "Pause listing"}
                      </button>
                      {isUpdating ? (
                        <button
                          type="button"
                          onClick={cancelInventoryUpdate}
                          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                            isLight
                              ? "text-slate-900 border-slate-300 hover:bg-slate-50"
                              : "text-white border-white/15 hover:bg-white/10"
                          }`}
                        >
                          Stop tracking
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
