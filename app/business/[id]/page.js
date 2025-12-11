"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Image from "next/image";

export default function BusinessPublicPage({ params }) {
  const { supabase } = useAuth();
  const router = useRouter();

  // ✅ FIX: unwrap params (Next.js 16 requirement)
  const { id } = use(params);

  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function loadBusiness() {
      if (!supabase || !id) {
        setLoading(false);
        return;
      }
      setLoading(true);

      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", id)
        .single();

      if (!error) {
        setBusiness(data);

        // 🔵 Increment view count
        await supabase.from("business_views").insert({
          business_id: id,
        });
      } else {
        console.error("Failed to load business", error);
      }

      setLoading(false);
    }

    loadBusiness();
  }, [id, supabase]);

  async function toggleSave() {
    if (!business) return;

    const action = saved ? "delete" : "insert";

    if (action === "insert") {
      await supabase.from("business_saves").insert({
        business_id: business.id,
      });
    } else {
      await supabase
        .from("business_saves")
        .delete()
        .eq("business_id", business.id);
    }

    setSaved(!saved);
  }

  if (loading)
    return (
      <div className="flex justify-center items-center h-[60vh] text-white">
        Loading business...
      </div>
    );

  if (!business)
    return (
      <div className="flex justify-center items-center h-[60vh] text-white">
        Business not found.
      </div>
    );

  return (
    <div className="min-h-screen text-white">
      {/* HEADER IMAGE */}
      <div className="h-64 relative bg-black/40">
        <Image
          src={business.banner_url || "/placeholder-banner.jpg"}
          alt={business.name}
          fill
          className="object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
      </div>

      {/* CONTENT */}
      <div className="max-w-5xl mx-auto px-6 -mt-20 relative z-10">
        {/* BUSINESS CARD */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-6">
            <Image
              src={business.logo_url || "/placeholder-logo.png"}
              alt={business.name}
              width={90}
              height={90}
              className="rounded-xl border border-white/20"
            />

            <div>
              <h1 className="text-3xl font-bold">{business.name}</h1>
              <p className="text-white/70">{business.category}</p>
            </div>

            <button
              onClick={toggleSave}
              className={`ml-auto px-4 py-2 rounded-xl font-semibold transition ${
                saved
                  ? "bg-rose-500 hover:bg-rose-600"
                  : "bg-purple-600 hover:bg-purple-700"
              }`}
            >
              {saved ? "Saved" : "Save"}
            </button>
          </div>

          {/* DESCRIPTION */}
          <p className="mt-6 text-white/80">{business.description}</p>

          {/* CONTACT */}
          <div className="mt-6 space-y-2 text-white/80">
            <p>
              <strong>Address:</strong> {business.address}
            </p>
            <p>
              <strong>Phone:</strong> {business.phone}
            </p>
            <p>
              <strong>Website:</strong> {business.website}
            </p>
          </div>

          {/* MESSAGE BUTTON */}
          <button
            onClick={() => router.push(`/business/${id}/contact`)}
            className="mt-8 w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 hover:opacity-95 transition"
          >
            Contact Business
          </button>
        </div>
      </div>
    </div>
  );
}
