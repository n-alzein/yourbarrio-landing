import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import PublicBusinessHero from "@/components/publicBusinessProfile/PublicBusinessHero";
import BusinessAbout from "@/components/publicBusinessProfile/BusinessAbout";
import BusinessAnnouncementsPreview from "@/components/publicBusinessProfile/BusinessAnnouncementsPreview";
import BusinessGalleryGrid from "@/components/publicBusinessProfile/BusinessGalleryGrid";
import BusinessListingsGrid from "@/components/publicBusinessProfile/BusinessListingsGrid";
import BusinessReviewsPanel from "@/components/publicBusinessProfile/BusinessReviewsPanel";
import PublicBusinessPreviewClient from "@/components/publicBusinessProfile/PublicBusinessPreviewClient";
import ProfileViewTracker from "@/components/publicBusinessProfile/ProfileViewTracker";

const PROFILE_FIELDS = [
  "id",
  "role",
  "business_name",
  "full_name",
  "category",
  "description",
  "website",
  "phone",
  "address",
  "city",
  "profile_photo_url",
  "cover_photo_url",
  "hours_json",
  "social_links_json",
].join(",");

const OPTIONAL_PUBLISH_FIELDS = ["is_published", "is_verified", "is_active"];

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

function pickPublishFlag(profile) {
  for (const key of OPTIONAL_PUBLISH_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(profile, key)) {
      return { key, value: Boolean(profile[key]) };
    }
  }
  return null;
}

async function safeQuery(promise, fallback, label) {
  try {
    const result = await promise;
    if (result.error) {
      const code = result.error?.code;
      const quietCodes = new Set(["42703", "42P01"]);
      if (!quietCodes.has(code)) {
        console.error(`[public business] ${label} query failed`, result.error);
      }
      return { data: fallback, count: 0 };
    }
    return { data: result.data ?? fallback, count: result.count ?? 0 };
  } catch (err) {
    console.error(`[public business] ${label} query failed`, err);
    return { data: fallback, count: 0 };
  }
}

async function fetchPublicProfile(supabase, id) {
  const base = await supabase
    .from("users")
    .select(PROFILE_FIELDS)
    .eq("id", id)
    .eq("role", "business")
    .maybeSingle();

  if (base.error) {
    console.error("[public business] profile query failed", base.error);
    return null;
  }

  const profile = base.data;
  if (!profile) return null;

  const optional = await supabase
    .from("users")
    .select(OPTIONAL_PUBLISH_FIELDS.join(","))
    .eq("id", id)
    .maybeSingle();

  if (!optional.error && optional.data) {
    return { ...profile, ...optional.data };
  }

  return profile;
}

function buildListingsQuery(supabase, businessId, limit, filters) {
  let query = supabase
    .from("listings")
    .select("id,business_id,title,price,category,city,photo_url,created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.status) {
    query = query.eq("status", "active");
  }
  if (filters.is_published) {
    query = query.eq("is_published", true);
  }
  if (filters.is_test) {
    query = query.eq("is_test", false);
  }

  return query;
}

async function fetchListingsWithFallback(supabase, businessId, limit) {
  const filterSets = [
    { status: true, is_published: true, is_test: true },
    { status: true, is_published: true },
    { is_published: true, is_test: true },
    { status: true },
    { is_published: true },
    { is_test: true },
    {},
  ];

  for (const filters of filterSets) {
    const result = await safeQuery(
      buildListingsQuery(supabase, businessId, limit, filters),
      [],
      "listings"
    );
    if (result.data?.length) {
      return result.data;
    }
  }

  return [];
}

async function fetchAnnouncements(supabase, businessId) {
  const nowIso = new Date().toISOString();
  const query = supabase
    .from("business_announcements")
    .select("id,business_id,title,body,starts_at,ends_at,created_at")
    .eq("business_id", businessId)
    .eq("is_published", true)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .order("created_at", { ascending: false })
    .limit(3);

  const result = await safeQuery(query, [], "announcements");
  return result.data || [];
}

async function fetchGallery(supabase, businessId) {
  const query = supabase
    .from("business_gallery_photos")
    .select("id,business_id,photo_url,caption,sort_order,created_at")
    .eq("business_id", businessId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(12);

  const result = await safeQuery(query, [], "gallery");
  return result.data || [];
}

async function fetchReviews(supabase, businessId) {
  const query = supabase
    .from("business_reviews")
    .select(
      "id,business_id,customer_id,rating,title,body,created_at,business_reply,business_reply_at"
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(10);

  const result = await safeQuery(query, [], "reviews");
  return result.data || [];
}

async function fetchReviewRatings(supabase, businessId) {
  const query = supabase
    .from("business_reviews")
    .select("rating")
    .eq("business_id", businessId);

  const result = await safeQuery(query, [], "review ratings");
  return result.data || [];
}

function descriptionSnippet(value) {
  if (!value) return "Discover this local business on YourBarrio.";
  const trimmed = value.trim();
  if (trimmed.length <= 160) return trimmed;
  return `${trimmed.slice(0, 157)}...`;
}

async function resolveAuthRole(supabase, user) {
  const metaRole =
    user?.app_metadata?.role || user?.user_metadata?.role || null;
  if (metaRole) return metaRole;
  if (!user?.id) return null;

  const { data, error } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[public business] role lookup failed", error);
  }

  return data?.role ?? null;
}

export async function generateMetadata({ params }) {
  const resolvedParams = await Promise.resolve(params);
  const businessId = resolvedParams?.id;
  const supabase = await createSupabaseServerClient();
  const profile = businessId ? await fetchPublicProfile(supabase, businessId) : null;
  if (!profile) {
    return {
      title: "Business profile unavailable",
      description: "This business profile is not available yet.",
    };
  }

  const publishFlag = pickPublishFlag(profile);
  let isEligible = false;

  if (publishFlag) {
    isEligible = publishFlag.value;
  } else {
    const listingPreview = await fetchListingsWithFallback(
      supabase,
      businessId,
      1
    );
    isEligible = listingPreview.length > 0;
  }

  if (!isEligible) {
    return {
      title: "Business profile unavailable",
      description: "This business profile is not available yet.",
    };
  }

  const name =
    profile?.business_name || profile?.full_name || "Local business";
  const description = descriptionSnippet(profile?.description);
  const image = profile?.cover_photo_url || profile?.profile_photo_url;

  return {
    title: `${name} on YourBarrio`,
    description,
    alternates: {
      canonical: `/b/${businessId || ""}`,
    },
    openGraph: {
      title: `${name} on YourBarrio`,
      description,
      images: image ? [{ url: image }] : [],
    },
  };
}

function UnavailableState() {
  return (
    <div className="min-h-screen text-white theme-lock">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900/70 to-black" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/60 to-black/90" />
        <div className="relative mx-auto max-w-4xl px-6 md:px-10 py-24 md:py-32 text-center">
          <h1 className="text-3xl md:text-4xl font-semibold">
            This business profile is not available.
          </h1>
          <p className="mt-3 text-sm md:text-base text-white/70">
            It may be offline or not ready for public viewing yet.
          </p>
          <Link
            href="/customer/home"
            className="mt-8 inline-flex items-center justify-center rounded-full bg-white/90 px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-white transition"
          >
            Back to customer home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function PublicBusinessProfilePage({ params, searchParams }) {
  const resolvedParams = await Promise.resolve(params);
  const resolvedSearch = await Promise.resolve(searchParams);
  const businessId = resolvedParams?.id;
  if (!businessId) return <UnavailableState />;
  const isPreview = resolvedSearch?.preview === "1";

  if (isPreview) {
    return <PublicBusinessPreviewClient businessId={businessId} trackView={false} />;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user ? await resolveAuthRole(supabase, user) : null;

  if (role === "customer") {
    return <PublicBusinessPreviewClient businessId={businessId} trackView />;
  }

  const profile = await fetchPublicProfile(supabase, businessId);

  if (!profile) {
    return <UnavailableState />;
  }

  const publishFlag = pickPublishFlag(profile);
  let isEligible = false;

  if (publishFlag) {
    isEligible = publishFlag.value;
  } else {
    const listingPreview = await fetchListingsWithFallback(
      supabase,
      businessId,
      1
    );
    isEligible = listingPreview.length > 0;
  }

  if (!isEligible) {
    return <UnavailableState />;
  }

  const [gallery, announcements, listings, reviews, reviewRatings] =
    await Promise.all([
      fetchGallery(supabase, businessId),
      fetchAnnouncements(supabase, businessId),
      fetchListingsWithFallback(supabase, businessId, 24),
      fetchReviews(supabase, businessId),
      fetchReviewRatings(supabase, businessId),
    ]);

  const ratingSummary = buildRatingSummary(reviewRatings || []);

  return (
    <div className="min-h-screen text-white -mt-20">
      <ProfileViewTracker businessId={businessId} />
      <PublicBusinessHero
        profile={profile}
        ratingSummary={ratingSummary}
        publicPath={`/b/${businessId}`}
      />

      <div className="mx-auto max-w-6xl px-6 md:px-10 pb-16 space-y-8">
        <BusinessAbout profile={profile} />

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
        />
      </div>
    </div>
  );
}
