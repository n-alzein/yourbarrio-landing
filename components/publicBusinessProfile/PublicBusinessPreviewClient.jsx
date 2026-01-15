"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient";
import PublicBusinessHero from "@/components/publicBusinessProfile/PublicBusinessHero";
import BusinessAbout from "@/components/publicBusinessProfile/BusinessAbout";
import BusinessAnnouncementsPreview from "@/components/publicBusinessProfile/BusinessAnnouncementsPreview";
import BusinessGalleryGrid from "@/components/publicBusinessProfile/BusinessGalleryGrid";
import BusinessListingsGrid from "@/components/publicBusinessProfile/BusinessListingsGrid";
import BusinessReviewsPanel from "@/components/publicBusinessProfile/BusinessReviewsPanel";

const EMPTY_SUMMARY = {
  count: 0,
  average: 0,
  breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

function buildRatingSummary(rows) {
  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  let count = 0;

  rows.forEach((row) => {
    const rating = Number(row.rating || 0);
    if (rating >= 1 && rating <= 5) {
      breakdown[rating] += 1;
      sum += rating;
      count += 1;
    }
  });

  const average = count ? sum / count : 0;
  return { count, average, breakdown };
}

function readPreviewCache(businessId) {
  if (!businessId || typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`yb_public_preview_${businessId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.businessId !== businessId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function PreviewSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-6 md:px-10 pb-16 space-y-8 mt-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
        <div className="h-5 w-32 rounded bg-white/10" />
        <div className="mt-4 space-y-2">
          <div className="h-4 w-full rounded bg-white/10" />
          <div className="h-4 w-5/6 rounded bg-white/10" />
          <div className="h-4 w-4/6 rounded bg-white/10" />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8 space-y-4">
          <div className="h-5 w-40 rounded bg-white/10" />
          <div className="h-20 w-full rounded bg-white/10" />
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
          <div className="h-5 w-32 rounded bg-white/10" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="h-28 rounded bg-white/10" />
            <div className="h-28 rounded bg-white/10" />
            <div className="h-28 rounded bg-white/10" />
            <div className="h-28 rounded bg-white/10" />
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
        <div className="h-5 w-32 rounded bg-white/10" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="h-40 rounded bg-white/10" />
          <div className="h-40 rounded bg-white/10" />
          <div className="h-40 rounded bg-white/10" />
        </div>
      </div>
    </div>
  );
}

export default function PublicBusinessPreviewClient({ businessId, onReady }) {
  const [profile, setProfile] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [listings, setListings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [ratingSummary, setRatingSummary] = useState(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = readPreviewCache(businessId);
    if (cached?.profile) {
      setProfile(cached.profile);
      setAnnouncements(cached.announcements || []);
      setGallery(cached.gallery || []);
      setListings(cached.listings || []);
      setReviews(cached.reviews || []);
      setRatingSummary(cached.ratingSummary || EMPTY_SUMMARY);
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!businessId) return;
      const client = getBrowserSupabaseClient();
      if (!client) return;

      const profileQuery = client
        .from("users")
        .select(
          "id,role,business_name,full_name,category,description,website,phone,address,city,profile_photo_url,cover_photo_url,hours_json,social_links_json"
        )
        .eq("id", businessId)
        .eq("role", "business")
        .maybeSingle();

      const nowIso = new Date().toISOString();

      const announcementsQuery = client
        .from("business_announcements")
        .select("id,business_id,title,body,starts_at,ends_at,created_at")
        .eq("business_id", businessId)
        .eq("is_published", true)
        .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
        .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
        .order("created_at", { ascending: false })
        .limit(3);

      const galleryQuery = client
        .from("business_gallery_photos")
        .select("id,business_id,photo_url,caption,sort_order,created_at")
        .eq("business_id", businessId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(12);

      const listingsQuery = client
        .from("listings")
        .select("id,business_id,title,price,category,city,photo_url,created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(24);

      const reviewsQuery = client
        .from("business_reviews")
        .select(
          "id,business_id,customer_id,rating,title,body,created_at,business_reply,business_reply_at"
        )
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(10);

      const ratingsQuery = client
        .from("business_reviews")
        .select("rating")
        .eq("business_id", businessId);

      const [
        profileResult,
        announcementsResult,
        galleryResult,
        listingsResult,
        reviewsResult,
        ratingsResult,
      ] = await Promise.all([
        profileQuery,
        announcementsQuery,
        galleryQuery,
        listingsQuery,
        reviewsQuery,
        ratingsQuery,
      ]);

      console.log("[public business] reviews load", {
        businessId,
        reviewsCount: reviewsResult?.data?.length || 0,
        ratingsCount: ratingsResult?.data?.length || 0,
      });

      if (!active) return;

      if (profileResult?.data) setProfile(profileResult.data);
      if (announcementsResult?.data) setAnnouncements(announcementsResult.data);
      if (galleryResult?.data) setGallery(galleryResult.data);
      if (listingsResult?.data) setListings(listingsResult.data);
      if (reviewsResult?.data) setReviews(reviewsResult.data);
      if (ratingsResult?.data) {
        setRatingSummary(buildRatingSummary(ratingsResult.data));
      }

      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [businessId]);

  useEffect(() => {
    if (!loading && profile) {
      onReady?.();
    }
  }, [loading, profile, onReady]);

  if (!profile) {
    return (
      <div className="min-h-screen text-white -mt-20">
        <div className="h-[170px] sm:h-[200px] md:h-[230px] bg-gradient-to-br from-slate-900 via-purple-900/70 to-black" />
        <PreviewSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white -mt-20">
      <PublicBusinessHero
        profile={profile}
        ratingSummary={ratingSummary}
        publicPath={`/b/${businessId}`}
      />

      <div className="mx-auto max-w-6xl px-6 md:px-10 pb-16 space-y-8">
        <BusinessAbout profile={profile} />

        {loading ? (
          <PreviewSkeleton />
        ) : (
          <>
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
              <BusinessAnnouncementsPreview announcements={announcements} />
              <BusinessGalleryGrid photos={gallery} />
            </div>

            <BusinessListingsGrid listings={listings} />

            <BusinessReviewsPanel
              businessId={businessId}
              initialReviews={reviews}
              ratingSummary={ratingSummary}
              reviewCount={ratingSummary?.count || reviews?.length || 0}
              loading={loading}
            />
          </>
        )}
      </div>
    </div>
  );
}
