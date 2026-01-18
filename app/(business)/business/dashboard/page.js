"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SafeImage from "@/components/SafeImage";
import { useAuth } from "@/components/AuthProvider";
import { useTheme } from "@/components/ThemeProvider";
import { getDisplayName } from "@/lib/messages";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

export default function BusinessDashboard() {
  const { user, profile, loadingUser } = useAuth();
  const { theme, hydrated: themeHydrated } = useTheme();
  const isLight = themeHydrated ? theme === "light" : true;
  const textTone = useMemo(
    () => ({
      base: isLight ? "text-slate-900" : "text-white",
      strong: isLight ? "text-slate-900" : "text-white/90",
      muted: isLight ? "text-slate-700" : "text-white/80",
      soft: isLight ? "text-slate-600" : "text-white/70",
      subtle: isLight ? "text-slate-500" : "text-white/60",
      faint: isLight ? "text-slate-400" : "text-white/50",
    }),
    [isLight]
  );
  const surfaceTone = useMemo(
    () => ({
      header: isLight
        ? "bg-white border border-slate-200 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.45)]"
        : "bg-white/5 border border-white/10 shadow-xl backdrop-blur-2xl",
      stat: isLight
        ? "bg-slate-50 border border-slate-200 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.4)]"
        : "bg-white/10 border border-white/20 shadow-xl backdrop-blur-xl",
      card: isLight
        ? "bg-white border border-slate-200 shadow-[0_24px_60px_-48px_rgba(15,23,42,0.45)]"
        : "bg-white/10 border border-white/20 shadow-xl backdrop-blur-xl",
      buttonPrimary: isLight
        ? "bg-slate-900 text-white border-slate-900 hover:bg-slate-800"
        : "bg-white/10 text-white border-white/15 hover:bg-white/20",
      buttonSecondary: isLight
        ? "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
        : "bg-white/5 text-white/80 border-white/15 hover:bg-white/10",
      buttonAccent: isLight
        ? "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-500"
        : "bg-indigo-500/30 text-white border-indigo-400/40 hover:bg-indigo-500/50",
    }),
    [isLight]
  );

  const [hydrated, setHydrated] = useState(false);
  const [business, setBusiness] = useState(null);
  const [stats, setStats] = useState(null);
  const [latestMessage, setLatestMessage] = useState(null);

  /* ------------------------------------------- */
  /* 1️⃣ Hydration flag (always first) */
  /* ------------------------------------------- */
  useEffect(() => {
    setHydrated(true);
  }, []);



  /* ------------------------------------------- */
  /* 2️⃣ Load business profile */
  /* ------------------------------------------- */
  useEffect(() => {
    if (business || !profile) return;
    if (user && profile.id !== user.id) return;
    setBusiness(profile);
  }, [business, profile, user]);

  useEffect(() => {
    if (!hydrated) return;
    if (!user && loadingUser) return;
    if (!user) return;
    if (business?.id === user.id && stats?._businessId === user.id) {
      return;
    }

    let cancelled = false;

    async function loadDashboard() {
      try {
        const response = await fetchWithTimeout("/api/business/dashboard", {
          method: "GET",
          credentials: "include",
          timeoutMs: 12000,
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "Failed to load dashboard data");
        }

        const payload = await response.json();
        if (cancelled) return;

        if (!business && payload?.business) {
          setBusiness(payload.business);
        }

        if (!stats || stats._businessId !== user.id) {
          setStats(payload?.stats ?? null);
        }

        setLatestMessage(payload?.latestMessage ?? null);
      } catch (err) {
        console.error("Dashboard: Failed to load dashboard data", err);
        if (cancelled) return;
        if (!stats) {
          setStats({
            views: 0,
            saves: 0,
            messages: 0,
            rating: "",
            reviewCount: 0,
            _businessId: user.id,
          });
        }
        setLatestMessage(null);
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [hydrated, loadingUser, user, business, stats]);

  /* ------------------------------------------- */
  /* 3️⃣ Load stats AFTER business exists */
  /* ------------------------------------------- */
  /* stats + latest message now loaded via /api/business/dashboard */

  /* ------------------------------------------- */
  /* 4️⃣ Block UI until ready */
  /* ------------------------------------------- */
  if (!hydrated) {
    return <div className="h-screen" />;
  }

  // Show loading state only if:
  // 1. We don't have business data yet, AND
  // 2. Either auth is still loading OR we haven't attempted to load business yet
  if (!business) {
    return (
      <div className={`min-h-screen px-6 md:px-10 pt-10 ${textTone.base} business-theme`}>
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
    <div className={`min-h-screen px-6 md:px-10 pt-0 pb-20 relative ${textTone.base} business-theme`}>

      {/* 🔥 SAME BACKGROUND AS BUSINESSES & ABOUT */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {isLight ? (
          <>
            <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-100" />
            <div className="pointer-events-none absolute -top-24 -left-20 h-[360px] w-[360px] rounded-full bg-indigo-200/45 blur-[110px]" />
            <div className="pointer-events-none absolute top-32 -right-24 h-[420px] w-[420px] rounded-full bg-emerald-200/35 blur-[120px]" />
            <div className="pointer-events-none absolute bottom-0 left-1/3 h-[320px] w-[320px] rounded-full bg-sky-200/40 blur-[130px]" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-[#05010d]" />
            <div className="absolute inset-0 bg-gradient-to-b from-purple-900/40 via-fuchsia-900/30 to-black" />
            <div className="pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-purple-600/30 blur-[120px]" />
            <div className="pointer-events-none absolute top-40 -right-24 h-[480px] w-[480px] rounded-full bg-pink-500/30 blur-[120px]" />
          </>
        )}
      </div>

      <div className="max-w-6xl mx-auto">

        {/* BANNER */}
        <section
          className={`flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-12 p-8 md:p-10 rounded-3xl ${surfaceTone.header}`}
        >
          <div className="flex flex-col md:flex-row md:items-center gap-6 text-center md:text-left">
            <div className={`w-32 h-32 rounded-2xl overflow-hidden ${isLight ? "ring-1 ring-slate-200" : ""}`}>
              <SafeImage
                src={business.profile_photo_url || "/business-placeholder.png"}
                alt="Business Logo"
                className="object-cover w-full h-full"
              />
            </div>

            <div className="flex flex-col gap-1">
              <h1 className="text-4xl font-bold">{business.business_name}</h1>
              <p className={`text-lg ${textTone.soft}`}>{business.category}</p>

              {business.city && (
                <p className={`text-sm ${textTone.subtle}`}>📍 {business.city}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-end gap-3">
            <Link
              href="/business/settings"
              className={`inline-flex px-5 py-2 rounded-xl border transition ${surfaceTone.buttonSecondary}`}
            >
              Manage Settings
            </Link>
            <Link
              href="/business/profile"
              className={`inline-flex px-5 py-2 rounded-xl border transition ${surfaceTone.buttonSecondary}`}
            >
              Business profile
            </Link>
            <Link
              href="/business/listings/new"
              className={`inline-flex px-5 py-2 rounded-xl border transition ${surfaceTone.buttonSecondary}`}
            >
              + New listing
            </Link>
          </div>
        </section>

        {/* STATS */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-14">
            <StatCard label="Profile Views" value={stats.views} tone={textTone} surface={surfaceTone} />
            <StatCard label="Messages" value={stats.messages} tone={textTone} surface={surfaceTone} />
            <StatCard label="Saves" value={stats.saves} tone={textTone} surface={surfaceTone} />
            <StatCard
              label="Rating"
              value={stats.rating}
              suffix={stats.rating ? "★" : ""}
              footnote={stats.reviewCount ? `${stats.reviewCount} reviews` : ""}
              tone={textTone}
              surface={surfaceTone}
            />
          </div>
        )}

        {/* ACTION CARDS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <DashboardCard title="Inbox" surface={surfaceTone}>
            {latestMessage ? (
              <div className="space-y-2 mb-4">
                <div className={`flex items-center justify-between text-[11px] uppercase tracking-[0.3em] ${textTone.faint}`}>
                  <span>{getDisplayName(latestMessage.customer)}</span>
                  <span>{formatMessageTime(latestMessage.time)}</span>
                </div>
                <p className={`text-sm ${textTone.muted} line-clamp-2`}>
                  {latestMessage.preview || "New message received from a customer."}
                </p>
              </div>
            ) : (
              <p className={`mb-4 ${textTone.subtle}`}>Customer messages appear here.</p>
            )}
            <Link
              href="/business/messages"
              className={`inline-block px-4 py-3 rounded-lg border transition ${surfaceTone.buttonSecondary}`}
            >
              Open Inbox
            </Link>
          </DashboardCard>

          <DashboardCard title="Reviews" surface={surfaceTone}>
            <p className={`mb-4 ${textTone.subtle}`}>See what customers are saying.</p>
            <Link
              href="/business/reviews"
              className={`inline-block px-4 py-3 rounded-lg border transition ${surfaceTone.buttonSecondary}`}
            >
              View Reviews
            </Link>
          </DashboardCard>

          <DashboardCard title="Photos & Media" surface={surfaceTone}>
            <p className={`mb-4 ${textTone.subtle}`}>Upload new business images.</p>
            <Link
              href="/business/media"
              className={`inline-block px-4 py-3 rounded-lg border transition ${surfaceTone.buttonSecondary}`}
            >
              Manage Photos
            </Link>
          </DashboardCard>

          <DashboardCard title="Manage Listings" surface={surfaceTone}>
            <p className={`mb-4 ${textTone.subtle}`}>Edit and manage your business listings.</p>
            <Link
              href="/business/listings"
              className={`inline-block px-4 py-3 rounded-lg border transition ${surfaceTone.buttonSecondary}`}
            >
              Open Listings
            </Link>
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, suffix = "", footnote = "", tone, surface }) {
  return (
    <div className={`rounded-2xl p-6 ${surface?.stat ?? "bg-white/10 border border-white/20 shadow-xl backdrop-blur-xl"}`}>
      <div className={`text-sm ${tone?.subtle ?? "text-white/60"}`}>{label}</div>
      <div className="text-3xl font-bold mt-1">
        {value}
        {suffix && <span className="text-lg ml-1">{suffix}</span>}
      </div>
      {footnote && <div className={`text-xs mt-1 ${tone?.faint ?? "text-white/50"}`}>{footnote}</div>}
    </div>
  );
}

function DashboardCard({ title, children, surface }) {
  return (
    <div className={`rounded-2xl p-8 ${surface?.card ?? "bg-white/10 border border-white/20 shadow-xl backdrop-blur-xl"}`}>
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      {children}
    </div>
  );
}

function formatMessageTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
