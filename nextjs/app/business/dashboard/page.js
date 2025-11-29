"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function BusinessDashboard() {
  const router = useRouter();
  const { supabase, user, role, loadingUser } = useAuth();

  /* ---------------------------------------------------------- */
  /*  INSTANT INITIAL VALUES FROM user                          */
  /* ---------------------------------------------------------- */
  const [business, setBusiness] = useState({
    business_name: user?.business_name || "",
    category: user?.category || "",
    city: user?.city || "",
    profile_photo_url: user?.profile_photo_url || "",
  });

  const [stats, setStats] = useState({
    views: "",
    messages: "",
    saves: "",
    rating: "",
    reviewCount: "",
  });

  // Fix logout UI delays
  useEffect(() => {
    supabase.auth.onAuthStateChange(() => {});
  }, []);

  /* ---------------------------------------------------------- */
  /*  AUTH CHECK — no blocking                                  */
  /* ---------------------------------------------------------- */
  useEffect(() => {
    if (loadingUser) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (role !== "business") {
      router.replace("/profile");
      return;
    }
  }, [loadingUser, user, role, router]);

  /* ---------------------------------------------------------- */
  /*  LOAD BUSINESS FROM SUPABASE (background refresh)          */
  /* ---------------------------------------------------------- */
  useEffect(() => {
    if (!user || role !== "business" || loadingUser) return;

    let active = true;

    async function refreshBusiness() {
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!active || !data) return;

      // merge fresh data with existing instant values
      setBusiness(prev => ({
        ...prev,
        ...data,
      }));
    }

    refreshBusiness();
    return () => (active = false);
  }, [loadingUser, user, role, supabase]);

  /* ---------------------------------------------------------- */
  /*  LOAD STATS IN BACKGROUND — instant values stay visible    */
  /* ---------------------------------------------------------- */
  useEffect(() => {
    if (!user) return;

    async function refreshStats() {
      const [viewsRes, savesRes, msgRes, reviewsRes] = await Promise.all([
        supabase
          .from("business_views")
          .select("id", { count: "exact", head: true })
          .eq("business_id", user.id),

        supabase
          .from("business_saves")
          .select("id", { count: "exact", head: true })
          .eq("business_id", user.id),

        supabase
          .from("business_messages")
          .select("id", { count: "exact", head: true })
          .eq("business_id", user.id),

        supabase
          .from("business_reviews")
          .select("rating")
          .eq("business_id", user.id),
      ]);

      const ratings = reviewsRes.data?.map(r => r.rating) ?? [];

      setStats({
        views: viewsRes.count ?? 0,
        saves: savesRes.count ?? 0,
        messages: msgRes.count ?? 0,
        rating: ratings.length
          ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
          : "",
        reviewCount: ratings.length,
      });
    }

    refreshStats();
  }, [user, supabase]);

  /* ---------------------------------------------------------- */
  /*  PAGE UI — zero blinking                                   */
  /* ---------------------------------------------------------- */

  return (
    <div className="min-h-screen px-6 md:px-10 pt-12 pb-20 relative text-white">

      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-black to-purple-900 opacity-70 -z-10" />
      <div className="absolute inset-0 backdrop-blur-2xl -z-10" />

      <div className="max-w-6xl mx-auto">

        {/* HEADER — always instant */}
        <div className="flex flex-col md:flex-row items-center gap-6 mb-14 bg-white/5 p-8 rounded-3xl border border-white/10 shadow-xl backdrop-blur-2xl">

          <Image
            src={business.profile_photo_url || "/business-placeholder.png"}
            width={128}
            height={128}
            alt="Business Logo"
            className="object-cover w-32 h-32 rounded-xl"
          />

          <div className="flex flex-col gap-1 text-center md:text-left">

            <h1 className="text-4xl font-bold">
              {business.business_name}
            </h1>

            <p className="text-white/70 text-lg">
              {business.category}
            </p>

            <p className="text-white/60 text-sm flex items-center gap-2">
              {business.city && <>📍 {business.city}</>}
            </p>

            <Link
              href="/business/profile/edit"
              className="
                mt-4 inline-flex px-5 py-2 rounded-xl 
                bg-white/10 border border-white/15 text-white/80 
                backdrop-blur-md 
                hover:bg-white/20 hover:text-white 
                transition
              "
            >
              Edit Profile
            </Link>
          </div>
        </div>

        {/* STATS — instant values, quiet refresh */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-14">

          <StatCard label="Profile Views" value={stats.views} />
          <StatCard label="Messages" value={stats.messages} />
          <StatCard label="Saves" value={stats.saves} />
          <StatCard
            label="Rating"
            value={stats.rating}
            suffix={stats.rating ? "★" : ""}
            footnote={stats.reviewCount ? `${stats.reviewCount} reviews` : ""}
          />

        </div>

        {/* ACTION CARDS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

          <DashboardCard title="Inbox">
            <p className="text-white/60 mb-4">Customer messages appear here.</p>
            <Link
              href="/business/inbox"
              className="inline-block px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition"
            >
              Open Inbox
            </Link>
          </DashboardCard>

          <DashboardCard title="Reviews">
            <p className="text-white/60 mb-4">See what customers are saying.</p>
            <Link
              href="/business/reviews"
              className="inline-block px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition"
            >
              View Reviews
            </Link>
          </DashboardCard>

          <DashboardCard title="Photos & Media">
            <p className="text-white/60 mb-4">Upload new business images.</p>
            <Link
              href="/business/media"
              className="inline-block px-4 py-3 rounded-lg bg-pink-600/40 hover:bg-pink-600/60 transition"
            >
              Manage Photos
            </Link>
          </DashboardCard>

          <DashboardCard title="Manage Listings">
            <p className="text-white/60 mb-4">Edit and manage your business listings.</p>
            <Link
              href="/business/listings"
              className="inline-block px-4 py-3 rounded-lg bg-blue-600/40 hover:bg-blue-600/60 transition"
            >
              Open Listings
            </Link>
          </DashboardCard>

        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- */
/* COMPONENTS                                                */
/* --------------------------------------------------------- */

function StatCard({ label, value, suffix = "", footnote = "" }) {
  return (
    <div className="bg-white/10 border border-white/20 rounded-2xl p-6 backdrop-blur-xl shadow-xl">
      <div className="text-white/60 text-sm">{label}</div>
      <div className="text-3xl font-bold mt-1">
        {value}
        {suffix && <span className="text-lg ml-1">{suffix}</span>}
      </div>
      {footnote && <div className="text-xs text-white/50 mt-1">{footnote}</div>}
    </div>
  );
}

function DashboardCard({ title, children }) {
  return (
    <div className="bg-white/10 border border-white/20 rounded-2xl p-8 backdrop-blur-xl shadow-xl">
      <h2 className="text-2xl font-semibold mb-4">{title}</h2>
      {children}
    </div>
  );
}
