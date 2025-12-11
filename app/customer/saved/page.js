"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export default function CustomerSavedPage() {
  const { user, supabase, loadingUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState([]);

  const loadSaved = useCallback(async () => {
    // Supabase may not be ready immediately; fail fast to avoid stuck loading
    if (!supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const userId = user?.id;
    if (!userId || typeof userId !== "string") {
      setSaved([]);
      setLoading(false);
      return;
    }

    try {
      const { data: savedRows, error } = await supabase
        .from("saved_listings")
        .select("listing_id")
        .eq("user_id", userId);

      if (error) throw error;

      const ids = savedRows?.map((row) => row.listing_id) || [];
      if (ids.length === 0) {
        setSaved([]);
        return;
      }

      const { data: listings, error: listError } = await supabase
        .from("listings")
        .select("*")
        .in("id", ids);

      if (listError) throw listError;

      setSaved(listings || []);
    } catch (err) {
      console.error("Saved listings load failed", err);
      setSaved([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, user?.id]);

  useEffect(() => {
    if (loadingUser) return;
    if (!user?.id) {
      setSaved([]);
      setLoading(false);
      return;
    }
    loadSaved();
  }, [loadingUser, user?.id, loadSaved]);
  

  if (loadingUser) return <div className="min-h-screen bg-black" />;

  return (
    <div className="min-h-screen pt-0 px-6 text-white">
      <div className="max-w-6xl mx-auto">

        <h1 className="text-4xl font-extrabold mb-6 tracking-tight">
          Saved Listings
        </h1>

        {loading && <p className="text-white/60">Loading...</p>}

        {!loading && saved.length === 0 && (
          <div className="text-center mt-20 text-white/70">
            <div className="text-8xl mb-6">💜</div>
            <h2 className="text-2xl font-bold mb-3">Nothing saved yet</h2>
            <p className="text-white/60 mb-6">
              Explore and save your favorite places.
            </p>
            <Link
              href="/customer/home"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-lg font-semibold hover:brightness-110 transition"
            >
              Discover Nearby
            </Link>
          </div>
        )}

        {!loading && saved.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
            {saved.map((item) => (
              <Link
                key={item.id}
                href={`/listings/${item.id}`}
                className="group bg-black/30 border border-white/10 rounded-2xl overflow-hidden shadow-lg backdrop-blur-xl hover:scale-[1.02] transition-all duration-300"
              >
                <div className="relative h-48 w-full overflow-hidden">
                  <img
                    src={item.photo_url || "/business-placeholder.png"}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                  />
                  <div className="absolute top-3 right-3 text-xs px-2 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur">
                    Saved
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="text-xl font-bold mb-1">
                    {item.title}
                  </h3>

                  <p className="text-white/60 text-sm line-clamp-2">
                    {item.description || "A local listing from YourBarrio."}
                  </p>

                  <div className="mt-3 text-sm text-pink-300 font-medium flex items-center gap-2">
                    <span>{item.category || "Listing"}</span>
                    {item.price ? <span className="text-white/70">· ${item.price}</span> : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
