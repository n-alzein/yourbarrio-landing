"use client";

import { useState, useEffect } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient";
import Link from "next/link";
import { primaryPhotoUrl } from "@/lib/listingPhotos";
import SafeImage from "@/components/SafeImage";
import { useSearchParams, useRouter } from "next/navigation";

export default function PublicListingsPage() {
  const supabase = getBrowserSupabaseClient();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();
  const category = searchParams.get("category")?.trim();
  const showListView = Boolean(category);

  useEffect(() => {
    load();
  }, [category]);

  async function load() {
    setLoading(true);
    let query = supabase.from("listings").select("*").order("created_at", {
      ascending: false,
    });
    if (category) {
      query = query.ilike("category", category);
    }
    const { data } = await query;

    setListings(data || []);
    setLoading(false);
  }

  return (
    <div className="max-w-4xl mx-auto py-2 md:pt-1">
      <div className="flex items-start justify-between gap-3">
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
        {showListView ? (
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-1 inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition"
          >
            ← Go back
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="text-gray-500">Loading listings...</div>
      ) : (
        <div className={showListView ? "space-y-4" : "grid grid-cols-1 md:grid-cols-2 gap-6"}>
          {listings.map((item) => (
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
                    {item.price ? <p className="text-gray-500">${item.price}</p> : null}
                  </div>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
