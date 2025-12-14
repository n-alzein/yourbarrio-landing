"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { primaryPhotoUrl } from "@/lib/listingPhotos";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient";
import { BookmarkCheck, Heart, Sparkles, Star } from "lucide-react";

export default function CustomerSavedPage() {
  const { user, supabase, loadingUser } = useAuth();
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(
    typeof document === "undefined" ? true : !document.hidden
  );

  const showLoading = !hasLoaded && (loadingUser || loading);

  useEffect(() => {
    const handleVisibility = () => setIsVisible(!document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Avoid getting stuck in loading if a request hangs
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setLoading(false), 8000);
    return () => clearTimeout(timer);
  }, [loading]);

  // Hydrate from session cache so the page shows instantly after navigation
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!user?.id) return;

    try {
      const raw = sessionStorage.getItem(`yb_saved_${user.id}`);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) {
        setSaved(parsed);
        setHasLoaded(true);
      }
    } catch {
      // ignore cache errors
    }
  }, [user?.id]);

  const loadSaved = useCallback(() => {
    const client = supabase ?? getBrowserSupabaseClient();
    const userId = user?.id;

    if (!client || !userId || typeof userId !== "string") {
      setSaved([]);
      setHasLoaded(true);
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading((prev) => (hasLoaded ? prev : true));

    (async () => {
      try {
        const { data: savedRows, error } = await client
          .from("saved_listings")
          .select("listing_id")
          .eq("user_id", userId);

        if (error) throw error;
        if (!active) return;

        const ids = (savedRows || [])
          .map((row) => row.listing_id)
          .filter(Boolean);

        if (ids.length === 0) {
          setSaved([]);
          setHasLoaded(true);
          if (typeof window !== "undefined") {
            try {
              sessionStorage.setItem(`yb_saved_${userId}`, JSON.stringify([]));
            } catch {
              /* ignore */
            }
          }
          return;
        }

        const { data: listings, error: listError } = await client
          .from("listings")
          .select("*")
          .in("id", ids);

        if (listError) throw listError;
        if (!active) return;

        const normalized = Array.isArray(listings) ? listings : [];
        setSaved(normalized);
        setHasLoaded(true);

        if (typeof window !== "undefined") {
          try {
            sessionStorage.setItem(
              `yb_saved_${userId}`,
              JSON.stringify(normalized)
            );
          } catch {
            /* ignore */
          }
        }
      } catch (err) {
        if (!active) return;
        console.error("Saved listings load failed", err);
        setSaved([]);
        setHasLoaded(true);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [supabase, user?.id, hasLoaded]);

  useEffect(() => {
    if (loadingUser) return;
    if (!isVisible && hasLoaded) return;

    const cleanup = loadSaved();
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, [loadingUser, loadSaved, isVisible, hasLoaded]);

  const totalSaved = saved.length;
  const averagePrice =
    totalSaved === 0
      ? 0
      : saved.reduce((sum, item) => sum + Number(item.price || 0), 0) /
        totalSaved;
  const distinctCategories = Array.from(
    new Set(saved.map((item) => item.category).filter(Boolean))
  );

  if (loadingUser) return <div className="min-h-screen bg-black" />;

  return (
    <div className="min-h-screen pt-2 md:pt-3 px-6 text-white relative overflow-hidden -mt-8 md:-mt-12 pb-12 md:pb-16">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b0720] via-[#0a0816] to-black" />
        <div className="absolute -top-32 -left-20 h-[360px] w-[360px] rounded-full bg-purple-600/20 blur-[120px]" />
        <div className="absolute top-10 right-10 h-[300px] w-[300px] rounded-full bg-pink-500/15 blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto space-y-20">
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden relative mt-[-12px] md:mt-[-16px] mb-12 md:mb-16">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-pink-500/15 to-transparent" />
          <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-white/70">
                <Sparkles className="h-4 w-4 text-pink-200" />
                Your saved collection
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold leading-tight">
                Keep favorites in one premium vault
              </h1>
              <p className="text-white/70 max-w-2xl">
                Curate the spots you love and jump back in instantly—no refreshing, no waiting.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-sm">
                  <Heart className="h-4 w-4 text-rose-200" />
                  {totalSaved} saved
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-sm">
                  <Star className="h-4 w-4 text-amber-200" />
                  {distinctCategories.length || "All"} categories
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-sm">
                  <BookmarkCheck className="h-4 w-4 text-emerald-200" />
                  Avg ${averagePrice ? averagePrice.toFixed(0) : "—"}
                </span>
              </div>
            </div>

            <div className="w-full md:w-auto">
              <Link
                href="/customer/home"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-500 px-5 py-3 text-sm font-semibold shadow-lg hover:scale-[1.02] transition"
              >
                Discover more
              </Link>
            </div>
          </div>
        </div>

        {showLoading && (
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 text-white/70">
            Fetching your saved picks...
          </div>
        )}

        {!showLoading && saved.length === 0 && (
          <div className="rounded-3xl border border-white/12 bg-white/5 backdrop-blur-xl shadow-2xl p-8 text-center space-y-4">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 border border-white/10 mx-auto">
              <Heart className="h-8 w-8 text-pink-200" />
            </div>
            <h2 className="text-2xl font-bold">Nothing saved yet</h2>
            <p className="text-white/60 max-w-xl mx-auto">
              Browse neighborhood favorites and tap the heart to save them here for quick access.
            </p>
            <Link
              href="/customer/home"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-lg font-semibold hover:brightness-110 transition shadow-lg"
            >
              Start exploring
            </Link>
          </div>
        )}

        {!showLoading && saved.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-white/60">Saved picks</p>
                <p className="text-lg font-semibold text-white">Handpicked just for you</p>
              </div>
              <div className="hidden md:flex items-center gap-2 text-sm text-white/70">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2">
                  <Sparkles className="h-4 w-4 text-pink-200" />
                  Freshly synced
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {saved.map((item) => (
                <Link
                  key={item.id}
                  href={`/listings/${item.id}`}
                  className="group relative rounded-2xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl hover:-translate-y-1 transition-transform duration-300"
                >
                  <div className="relative h-48 w-full overflow-hidden">
                    <img
                      src={
                        primaryPhotoUrl(item.photo_url) ||
                        "/business-placeholder.png"
                      }
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                    <div className="absolute top-3 left-3 text-xs px-3 py-1 rounded-full bg-black/50 border border-white/15 backdrop-blur flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5 text-pink-200" />
                      Saved
                    </div>
                    {item.price ? (
                      <div className="absolute bottom-3 right-3 rounded-xl bg-black/60 border border-white/10 px-3 py-1 text-sm font-semibold">
                        ${item.price}
                      </div>
                    ) : null}
                  </div>

                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold leading-tight">
                          {item.title}
                        </h3>
                        <p className="text-xs uppercase tracking-wide text-white/60">
                          {item.category || "Listing"}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70">
                        <BookmarkCheck className="h-3.5 w-3.5" />
                        Quick open
                      </span>
                    </div>

                    <p className="text-white/70 text-sm line-clamp-2">
                      {item.description || "A local listing from YourBarrio."}
                    </p>

                    <div className="flex items-center justify-between text-sm text-white/70 pt-1">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        In your vault
                      </span>
                      <span className="text-white/60">View details →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
