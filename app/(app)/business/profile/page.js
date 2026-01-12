import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import BusinessProfilePage from "@/components/business/profile/BusinessProfilePage";

async function safeQuery(promise, fallback, label) {
  try {
    const result = await promise;
    if (result.error) {
      console.error(`[business profile] ${label} query failed`, result.error);
      return { data: fallback, count: 0 };
    }
    return { data: result.data ?? fallback, count: result.count ?? 0 };
  } catch (err) {
    console.error(`[business profile] ${label} query failed`, err);
    return { data: fallback, count: 0 };
  }
}

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

export default async function BusinessProfileRoute() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/business-auth/login");
  }

  const profileQuery = supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const galleryQuery = supabase
    .from("business_gallery_photos")
    .select("id, business_id, photo_url, caption, sort_order, created_at")
    .eq("business_id", user.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  const reviewListQuery = supabase
    .from("business_reviews")
    .select(
      "id, business_id, customer_id, rating, title, body, created_at, business_reply, business_reply_at"
    )
    .eq("business_id", user.id)
    .order("created_at", { ascending: false })
    .range(0, 5);

  const reviewRatingQuery = supabase
    .from("business_reviews")
    .select("rating")
    .eq("business_id", user.id);

  const listingsQuery = supabase
    .from("listings")
    .select("id, business_id, title, price, category, photo_url, created_at")
    .eq("business_id", user.id)
    .order("created_at", { ascending: false });

  const announcementsQuery = supabase
    .from("business_announcements")
    .select("id, business_id, title, body, is_published, starts_at, ends_at, created_at")
    .eq("business_id", user.id)
    .order("created_at", { ascending: false });

  const [profileResult, galleryResult, reviewListResult, reviewRatingsResult, listingsResult, announcementsResult] =
    await Promise.all([
      safeQuery(profileQuery, null, "profile"),
      safeQuery(galleryQuery, [], "gallery"),
      safeQuery(reviewListQuery, [], "reviews"),
      safeQuery(reviewRatingQuery, [], "review ratings"),
      safeQuery(listingsQuery, [], "listings"),
      safeQuery(announcementsQuery, [], "announcements"),
    ]);

  const rawProfile = profileResult.data || {};
  const profile = (rawProfile && Object.keys(rawProfile).length ? {
    id: rawProfile.id,
    role: rawProfile.role,
    full_name: rawProfile.full_name,
    business_name: rawProfile.business_name,
    category: rawProfile.category,
    description: rawProfile.description,
    website: rawProfile.website,
    phone: rawProfile.phone,
    email: rawProfile.email,
    address: rawProfile.address,
    city: rawProfile.city,
    hours_json: rawProfile.hours_json ?? null,
    social_links_json: rawProfile.social_links_json ?? null,
    profile_photo_url: rawProfile.profile_photo_url,
    cover_photo_url: rawProfile.cover_photo_url,
  } : null) || {
    id: user.id,
    business_name: user.user_metadata?.full_name || "",
    full_name: user.user_metadata?.full_name || "",
    category: "",
    description: "",
    website: "",
    phone: "",
    email: user.email || "",
    address: "",
    city: "",
    hours_json: null,
    social_links_json: null,
    profile_photo_url: "",
    cover_photo_url: "",
  };

  const ratingSummary = buildRatingSummary(reviewRatingsResult.data || []);

  return (
    <BusinessProfilePage
      initialProfile={profile}
      initialGallery={galleryResult.data || []}
      initialReviews={reviewListResult.data || []}
      initialReviewCount={ratingSummary.count}
      initialListings={listingsResult.data || []}
      initialAnnouncements={announcementsResult.data || []}
      ratingSummary={ratingSummary}
    />
  );
}
