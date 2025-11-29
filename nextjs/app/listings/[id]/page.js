"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabaseClient";
import Image from "next/image";

export default function ListingDetails({ params }) {
  const supabase = createBrowserClient();
  const id = params.id;

  const [listing, setListing] = useState(null);
  const [business, setBusiness] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: item } = await supabase
      .from("listings")
      .select("*")
      .eq("id", id)
      .single();

    setListing(item);

    const { data: biz } = await supabase
      .from("users")
      .select("business_name, category, city, website, phone")
      .eq("id", item.business_id)
      .single();

    setBusiness(biz);
  }

  if (!listing) return <p>Loading…</p>;

  return (
    <div className="max-w-3xl mx-auto py-10">
      <Image
        src={listing.photo_url || "/business-placeholder.png"}
        width={800}
        height={600}
        className="rounded-lg object-cover"
        alt="Listing"
      />

      <h1 className="text-4xl font-bold mt-6">{listing.title}</h1>
      <p className="text-2xl text-green-600 mt-2">${listing.price}</p>

      <p className="mt-4">{listing.description}</p>

      <div className="mt-6 border-t pt-6">
        <h2 className="text-xl font-semibold">Business Information</h2>
        <p>{business?.business_name}</p>
        <p>{business?.city}</p>
        <p>{business?.category}</p>
        <p>{business?.website}</p>
        <p>{business?.phone}</p>
      </div>
    </div>
  );
}
