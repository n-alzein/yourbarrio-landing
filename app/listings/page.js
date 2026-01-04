"use client";

import { useState, useEffect } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient";
import Link from "next/link";
import { primaryPhotoUrl } from "@/lib/listingPhotos";
import SafeImage from "@/components/SafeImage";

export default function PublicListingsPage() {
  const supabase = getBrowserSupabaseClient();
  const [listings, setListings] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("listings")
      .select("*")
      .order("created_at", { ascending: false });

    setListings(data || []);
  }

  return (
    <div className="max-w-4xl mx-auto py-2 md:pt-1">
      <h1 className="text-3xl font-bold mb-6">All Listings</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {listings.map((item) => (
          <Link key={item.id} href={`/listing/${item.id}`}>
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
                <p className="text-gray-500">${item.price}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
