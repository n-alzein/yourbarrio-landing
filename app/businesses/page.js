"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient";
import Link from "next/link";
import PublicNavbar from "@/components/navbars/PublicNavbar";


export default function PublicBusinessesPage() {
  const supabase = getBrowserSupabaseClient();
  const [businesses, setBusinesses] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBusinesses() {
      const { data, error } = await supabase
        .from("users")
        .select("id, business_name, category, city, profile_photo_url, description")
        .eq("role", "business");

      if (error) console.error(error);
      setBusinesses(data || []);
      setLoading(false);
    }

    loadBusinesses();
  }, [supabase]);

  return (
    <>
    <PublicNavbar />
    <main className="min-h-screen text-white pt-28 px-6">
        
      {/* HERO */}
      <section className="max-w-7xl mx-auto text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
          Discover Local Businesses
        </h1>
        <p className="text-white/70 mt-3 text-lg max-w-2xl mx-auto">
          Explore neighborhood shops, cafés, studios, markets, and more.  
          Support your community — even before creating an account.
        </p>
      </section>

      {/* BUSINESS CARDS */}
      <section className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading && (
          <div className="col-span-full text-center text-white/60">Loading...</div>
        )}

        {!loading && businesses?.length === 0 && (
          <div className="col-span-full text-center text-white/60">
            No businesses found.
          </div>
        )}

        {businesses?.map((biz) => (
          <div
            key={biz.id}
            className="rounded-2xl bg-white/5 border border-white/10 p-5 backdrop-blur-xl shadow-lg hover:bg-white/10 transition"
          >
            {/* Image */}
            <div className="w-full h-40 rounded-xl overflow-hidden bg-black/40 border border-white/10">
              <img
                src={biz.profile_photo_url || "/business-placeholder.png"}
                alt={biz.business_name}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Info */}
            <div className="mt-4">
              <h2 className="text-xl font-semibold tracking-tight">
                {biz.business_name}
              </h2>

              <p className="text-white/70 text-sm mt-1">
                {biz.category || "Uncategorized"}
              </p>

              <p className="text-white/60 text-xs mt-1">
                {biz.city || "Location not specified"}
              </p>

              <p className="text-white/60 text-sm mt-3 line-clamp-2">
                {biz.description || "No description provided."}
              </p>

              <Link
                href="/auth/register"
                className="
                  inline-block mt-4 w-full text-center py-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 font-semibold text-white hover:brightness-110 transition"
              >
                Sign up to view more →
              </Link>
            </div>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto text-center mt-16 pb-16">
        <h3 className="text-2xl font-bold">Want a personalized experience?</h3>
        <p className="text-white/70 mt-2">
          Create an account to save businesses, get recommendations, and explore nearby deals.
        </p>

        <Link
          href="/auth/register"
          className="
            inline-flex items-center justify-center mt-5 px-6 py-3 rounded-xl bg-white text-black font-semibold text-lg hover:bg-white/90 transition"
        >
          Create a Free Account
        </Link>
      </section>
    </main>
    </>
  );
  
}
