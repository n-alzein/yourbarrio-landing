"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createBrowserClient } from "@/lib/supabaseClient";

export default function BusinessDashboard() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState(null);
  const [stats, setStats] = useState({
    views: 0,
    messages: 0,
    saves: 0,
    rating: null,
    reviewCount: 0,
  });

  useEffect(() => {
    (async () => {
      setLoading(true);

      // Step 1: Get current user
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        setLoading(false);
        return;
      }

      const user = userData.user;

      // Step 2: Fetch business profile (REAL TABLE)
      const { data: biz } = await supabase
        .from("business_profiles")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!biz) {
        setBusiness(null);
        setLoading(false);
        return;
      }

      setBusiness(biz);

      // Step 3: Fetch analytics
      const [viewsRes, savesRes, msgRes, reviewsRes] = await Promise.all([
        supabase
          .from("business_views")
          .select("id", { count: "exact", head: true })
          .eq("business_id", biz.id),

        supabase
          .from("business_saves")
          .select("id", { count: "exact", head: true })
          .eq("business_id", biz.id),

        supabase
          .from("business_messages")
          .select("id", { count: "exact", head: true })
          .eq("business_id", biz.id),

        supabase
          .from("business_reviews")
          .select("rating")
          .eq("business_id", biz.id),
      ]);

      const viewCount = viewsRes.count ?? 0;
      const saveCount = savesRes.count ?? 0;
      const msgCount = msgRes.count ?? 0;

      const ratings = reviewsRes.data?.map((r) => r.rating) ?? [];
      const reviewCount = ratings.length;
      const avgRating =
        reviewCount > 0
          ? (ratings.reduce((a, b) => a + b, 0) / reviewCount).toFixed(1)
          : null;

      setStats({
        views: viewCount,
        messages: msgCount,
        saves: saveCount,
        rating: avgRating,
        reviewCount,
      });

      setLoading(false);
    })();
  }, [supabase]);

  return (
    <div className="min-h-screen px-6 md:px-10 pt-24 pb-20 relative text-white">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-black to-purple-900 opacity-70 -z-10"></div>
      <div className="absolute inset-0 backdrop-blur-2xl -z-10"></div>

      <div className="max-w-6xl mx-auto">

        {/* ─────────────────────────────────────────────── */}
        {/*          BUSINESS HEADER (Always Visible)       */}
        {/* ─────────────────────────────────────────────── */}
        {business && (
          <div className="flex flex-col md:flex-row items-center gap-6 mb-14 bg-white/5 p-8 rounded-3xl border border-white/10 shadow-xl backdrop-blur-2xl">

            {/* Logo */}
            <div className="w-32 h-32 rounded-2xl overflow-hidden border border-white/20 bg-black/30">
              <Image
                src={business.profile_photo_url || "/business-placeholder.png"}
                width={128}
                height={128}
                alt="Business Logo"
                className="object-cover w-full h-full"
              />
            </div>

            {/* Business Info */}
            <div className="flex flex-col gap-1 text-center md:text-left">
              <h1 className="text-4xl font-bold">
                {business.business_name}
              </h1>

              <p className="text-white/70 text-lg">
                {business.category || "Category not set"}
              </p>

              <p className="text-white/60 text-sm flex items-center gap-2">
                📍 {business.city || "City not specified"}
              </p>

              <Link
                href="/business/profile/edit"
                className="mt-4 inline-flex px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 font-semibold shadow-lg hover:scale-[1.03] active:scale-[0.97] transition"
                >
                Edit Profile
              </Link>

            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────── */}
        {/*                 ANALYTICS BLOCK                 */}
        {/* ─────────────────────────────────────────────── */}
        {business && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-14">
              <StatCard label="Profile Views" value={loading ? "—" : stats.views} />
              <StatCard label="Messages" value={loading ? "—" : stats.messages} />
              <StatCard label="Saves" value={loading ? "—" : stats.saves} />
              <StatCard
                label="Rating"
                value={loading ? "—" : stats.rating ?? "No ratings"}
                suffix={stats.rating ? "★" : ""}
                footnote={stats.reviewCount ? `${stats.reviewCount} reviews` : ""}
              />
            </div>

            {/* ───────────────────────────────────────────── */}
            {/*                    ACTION CARDS                */}
            {/* ───────────────────────────────────────────── */}
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
                <p className="text-white/60 mb-4">
                  View what customers are saying about your business.
                </p>
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

            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*                    REUSABLE COMPONENTS                     */
/* ────────────────────────────────────────────────────────── */

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
