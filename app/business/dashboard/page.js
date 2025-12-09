"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function BusinessDashboard() {
  const router = useRouter();
  const { supabase, user, authUser, role, loadingUser } = useAuth();

  const [hydrated, setHydrated] = useState(false);
  const [business, setBusiness] = useState(null);
  const [stats, setStats] = useState(null);

  /* ------------------------------------------- */
  /* 1️⃣ Hydration flag (always first) */
  /* ------------------------------------------- */
  useEffect(() => {
    setHydrated(true);
  }, []);

  /* ------------------------------------------- */
  /* 2️⃣ Auth guard */
  /* ------------------------------------------- */
  useEffect(() => {
    if (!hydrated) return;
    if (loadingUser) return;

    if (!user) {
      router.replace("/business-auth/login");
      return;
    }

    if (role !== "business") {
      router.replace("/customer/settings");
      return;
    }
  }, [hydrated, loadingUser, user, role, router]);

  /* ------------------------------------------- */
  /* 3️⃣ Load business profile */
  /* ------------------------------------------- */
  useEffect(() => {
    // Use profile from AuthProvider immediately to avoid blank screen while refetching
    if (user && role === "business" && !business) {
      setBusiness(user);
    }
  }, [user, role, business]);

  useEffect(() => {
    if (!hydrated) return;
    if (loadingUser) return;
    if (role !== "business") return;

    const id = user?.id || authUser?.id;
    if (!id) return;

    let active = true;

    async function loadBusiness() {
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("id", id)
        .single();

      if (active) setBusiness(data);
    }

    loadBusiness();
    return () => {
      active = false;
    };
  }, [hydrated, loadingUser, user, role, supabase]);

  /* ------------------------------------------- */
  /* 4️⃣ Load stats AFTER business exists */
  /* ------------------------------------------- */
  useEffect(() => {
    if (!hydrated) return;
    if (!business) return;

    async function loadStats() {
      const [viewsRes, savesRes, msgRes, reviewsRes] = await Promise.all([
        supabase
          .from("business_views")
          .select("id", { count: "exact", head: true })
          .eq("business_id", business.id),

        supabase
          .from("business_saves")
          .select("id", { count: "exact", head: true })
          .eq("business_id", business.id),

        supabase
          .from("business_messages")
          .select("id", { count: "exact", head: true })
          .eq("business_id", business.id),

        supabase
          .from("business_reviews")
          .select("rating")
          .eq("business_id", business.id),
      ]);

      const ratings = reviewsRes.data?.map((r) => r.rating) ?? [];

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

    loadStats();
  }, [hydrated, business, supabase]);

  /* ------------------------------------------- */
  /* 5️⃣ Block UI until ready */
  /* ------------------------------------------- */
  if (!hydrated || loadingUser) return <div className="h-screen" />;

  if (!business) {
    return (
      <div className="min-h-screen px-6 md:px-10 pt-10 text-white">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-10 animate-pulse">
            <div className="h-6 w-40 bg-white/20 rounded mb-4" />
            <div className="h-4 w-64 bg-white/15 rounded mb-2" />
            <div className="h-4 w-52 bg-white/15 rounded" />
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------- */
  /* 6️⃣ UI with shared background */
  /* ------------------------------------------- */
  return (
    <div className="min-h-screen px-6 md:px-10 pt-0 pb-20 relative text-white">

      {/* 🔥 SAME BACKGROUND AS BUSINESSES & ABOUT */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[#05010d]" />
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/40 via-fuchsia-900/30 to-black" />
        <div className="pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-purple-600/30 blur-[120px]" />
        <div className="pointer-events-none absolute top-40 -right-24 h-[480px] w-[480px] rounded-full bg-pink-500/30 blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row items-center gap-6 mb-12 bg-white/5 p-8 rounded-3xl border border-white/10 shadow-xl backdrop-blur-2xl">

          <Image
            src={business.profile_photo_url || "/business-placeholder.png"}
            width={128}
            height={128}
            alt="Business Logo"
            className="object-cover w-32 h-32 rounded-xl"
          />

          <div className="flex flex-col gap-1 text-center md:text-left">
            <h1 className="text-4xl font-bold">{business.business_name}</h1>
            <p className="text-white/70 text-lg">{business.category}</p>

            {business.city && (
              <p className="text-white/60 text-sm">📍 {business.city}</p>
            )}

            <Link
              href="/business/settings"
              className="mt-4 inline-flex px-5 py-2 rounded-xl bg-white/10 border border-white/15 text-white/80 hover:bg-white/20 hover:text-white transition"
            >
              Manage Settings
            </Link>
          </div>
        </div>

        {/* STATS */}
        {stats && (
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
        )}

        {/* ACTION CARDS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <DashboardCard title="Inbox">
            <p className="text-white/60 mb-4">Customer messages appear here.</p>
            <Link href="/business/inbox" className="inline-block px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition">
              Open Inbox
            </Link>
          </DashboardCard>

          <DashboardCard title="Reviews">
            <p className="text-white/60 mb-4">See what customers are saying.</p>
            <Link href="/business/reviews" className="inline-block px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition">
              View Reviews
            </Link>
          </DashboardCard>

          <DashboardCard title="Photos & Media">
            <p className="text-white/60 mb-4">Upload new business images.</p>
            <Link href="/business/media" className="inline-block px-4 py-3 rounded-lg bg-pink-600/40 hover:bg-pink-600/60 transition">
              Manage Photos
            </Link>
          </DashboardCard>

          <DashboardCard title="Manage Listings">
            <p className="text-white/60 mb-4">Edit and manage your business listings.</p>
            <Link href="/business/listings" className="inline-block px-4 py-3 rounded-lg bg-blue-600/40 hover:bg-blue-600/60 transition">
              Open Listings
            </Link>
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}

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
