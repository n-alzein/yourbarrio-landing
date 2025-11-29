"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Image from "next/image";

export default function BusinessListingsPage() {
  const { supabase, authUser, role, loadingUser } = useAuth();
  const router = useRouter();

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (loadingUser) return;

    if (!authUser) {
      router.push("/login");
      return;
    }

    if (role !== "business") {
      router.push("/profile");
      return;
    }

    load();
  }, [authUser, loadingUser, role]);

  async function load() {
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("business_id", authUser.id)
      .order("created_at", { ascending: false });

    setListings(data || []);
    setLoading(false);
  }

  return (
    <div className="max-w-3xl mx-auto py-10">
      <div className="flex justify-between mb-6">
        <h1 className="text-3xl font-bold">Your Listings</h1>
        <button
          onClick={() => router.push("/business/listings/new")}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          + New Listing
        </button>
      </div>

      {loading && <p>Loading...</p>}

      {listings.length === 0 && !loading && <p>No listings yet.</p>}

      <div className="grid gap-4">
        {listings.map((item) => (
          <div
            key={item.id}
            className="border rounded-lg p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <Image
                src={item.photo_url || "/business-placeholder.png"}
                width={80}
                height={80}
                className="rounded-md object-cover"
                alt="Listing"
              />

              <div>
                <h2 className="font-semibold">{item.title}</h2>
                <p className="text-gray-500">${item.price}</p>
              </div>
            </div>

            <button
              className="px-3 py-1 bg-gray-200 rounded"
              onClick={() =>
                router.push(`/business/listings/${item.id}/edit`)
              }
            >
              Edit
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
