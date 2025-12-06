"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export default function CustomerSavedPage() {
  const { user, supabase, loadingUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState([]);

  async function loadSaved() {
    setLoading(true);
  
    // 🚨 HARD GUARD — prevents UUID errors 100%
    const userId = user?.id;
    if (!userId || typeof userId !== "string") {
      console.warn("Saved listings: user.id missing, aborting.");
      setSaved([]);
      setLoading(false);
      return;
    }
  
    // 1️⃣ Fetch saved listing IDs
    const { data: savedRows, error } = await supabase
      .from("saved_listings")
      .select("listing_id")
      .eq("user_id", userId); // <-- ALWAYS safe now
  
    if (error) {
      console.error("Saved listings error:", error);
      setLoading(false);
      return;
    }
  
    const ids = savedRows?.map((row) => row.listing_id) || [];
  
    if (ids.length === 0) {
      setSaved([]);
      setLoading(false);
      return;
    }
  
    // 2️⃣ Fetch actual listing objects
    const { data: listings, error: listError } = await supabase
      .from("listings")
      .select("*")
      .in("id", ids);
  
    if (listError) {
      console.error("Listings error:", listError);
      setSaved([]);
      setLoading(false);
      return;
    }
  
    setSaved(listings || []);
    setLoading(false);
  }
  

  if (loadingUser) return <div className="min-h-screen bg-black" />;

  return (
    <div className="min-h-screen pt-32 px-6 text-white">
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
              href="/customer/businesses"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-lg font-semibold hover:brightness-110 transition"
            >
              Discover Businesses
            </Link>
          </div>
        )}

        {!loading && saved.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
            {saved.map((item) => (
              <Link
                key={item.id}
                href={`/business/${item.id}`}
                className="group bg-black/30 border border-white/10 rounded-2xl overflow-hidden shadow-lg backdrop-blur-xl hover:scale-[1.02] transition-all duration-300"
              >
                <div className="relative h-48 w-full overflow-hidden">
                  <img
                    src={item.cover_photo_url || "/business-placeholder.png"}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                  />
                </div>

                <div className="p-4">
                  <h3 className="text-xl font-bold mb-1">
                    {item.name}
                  </h3>

                  <p className="text-white/60 text-sm line-clamp-2">
                    {item.description}
                  </p>

                  <p className="mt-3 text-sm text-pink-300 font-medium">
                    {item.category}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
