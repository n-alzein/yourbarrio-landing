"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function BusinessListingsPage() {
  const { supabase, authUser, loadingUser } = useAuth();
  const router = useRouter();

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  // ------------------------------------------------------
  //  SAFE AUTH GUARD + FETCH
  // ------------------------------------------------------
  useEffect(() => {
    if (loadingUser) return; // Wait for auth
    if (!authUser) {
      router.push("/business-auth/login"); // ← FIXED
      return;
    }

    async function fetchListings() {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("business_id", authUser.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Fetch listings error:", error);
      } else {
        setListings(data || []);
      }

      setLoading(false);
    }

    fetchListings();
  }, [loadingUser, authUser, supabase, router]);

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
  if (loadingUser || loading) {
    return (
      <p className="text-white text-center py-20">
        Loading listings...
      </p>
    );
  }

  // ------------------------------------------------------
  // RENDER
  // ------------------------------------------------------
  return (
    <div className="max-w-5xl mx-auto px-6 py-16">

      <div className="mb-6 text-center">
        <h1 className="text-4xl font-extrabold text-white drop-shadow-sm">
          Your Listings
        </h1>
      </div>

      {/* CREATE NEW LISTING */}
      <div className="flex justify-center mb-12">
        <button
          onClick={() => router.push("/business/listings/new")}
          className="
            px-6 py-3 
            rounded-2xl 
            bg-gradient-to-r from-blue-600 to-indigo-600 
            text-white text-lg font-semibold 
            shadow-lg hover:opacity-90 transition
          "
        >
          + Create New Listing
        </button>
      </div>

      {/* EMPTY STATE */}
      {listings.length === 0 && (
        <p className="text-gray-300 text-center py-10">
          You haven’t created any listings yet.
        </p>
      )}

      {/* LIST GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
        {listings.map((listing) => (
          <div
            key={listing.id}
            className="
              backdrop-blur-xl bg-white/10 border border-white/20 
              rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.3)] 
              hover:bg-white/15 transition flex flex-col
            "
          >
            {listing.photo_url ? (
              <img
                src={listing.photo_url}
                alt={listing.title}
                className="w-full h-48 object-cover rounded-2xl mb-4"
              />
            ) : (
              <div className="w-full h-48 bg-white/10 rounded-2xl flex items-center justify-center text-gray-400">
                No Image
              </div>
            )}

            <h2 className="text-xl text-white font-semibold mb-1">
              {listing.title}
            </h2>

            <div className="flex justify-between text-gray-300 mb-4">
              <span>{listing.category}</span>
              <span className="font-medium text-white">${listing.price}</span>
            </div>

            <div className="flex items-center justify-between mt-auto gap-3">
              {/* EDIT */}
              <button
                onClick={() =>
                  router.push(`/business/listings/${listing.id}/edit`)
                }
                className="
                  flex items-center gap-2 px-4 py-2 rounded-xl 
                  backdrop-blur-md bg-white/10 
                  border border-white/20 
                  text-white text-sm hover:bg-white/20 
                  hover:border-white/30 transition
                "
              >
                ✏️ Edit
              </button>

              {/* DELETE */}
              <button
                onClick={() => handleDelete(listing.id)}
                className="
                  flex items-center gap-2 px-4 py-2 rounded-xl 
                  bg-gradient-to-r from-red-600/80 to-rose-600/80 
                  text-white text-sm font-medium shadow-md 
                  hover:opacity-90 transition
                "
              >
                🗑 Delete
              </button>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
