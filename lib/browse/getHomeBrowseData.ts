import "server-only";

import { fetchFeaturedCategories, fetchStrapiBanners, type FeaturedCategory } from "@/lib/strapi";
import { getPublicSupabaseServerClient } from "@/lib/supabasePublicServer";

export type BrowseMode = "public" | "customer";

export type ListingSummary = {
  id: string;
  title: string | null;
  description: string | null;
  price: number | string | null;
  category: string | null;
  category_id: string | number | null;
  category_info: { name?: string | null; slug?: string | null } | null;
  city: string | null;
  photo_url: unknown;
  business_id: string | null;
  created_at: string | null;
  inventory_status?: string | null;
  inventory_quantity?: number | null;
  low_stock_threshold?: number | null;
  inventory_last_updated_at?: string | null;
};

export type CategorySummary = FeaturedCategory;

export type HomeBrowseData = {
  featuredCategories: CategorySummary[];
  featuredCategoriesError: string | null;
  listings: ListingSummary[];
  banners: unknown[];
  city: string | null;
  zip: string | null;
};

type GetHomeBrowseDataArgs = {
  mode: BrowseMode;
  city?: string | null;
  zip?: string | null;
  limit?: number;
};

const PUBLIC_LISTING_SELECT = [
  "id",
  "title",
  "description",
  "price",
  "category",
  "category_id",
  "category_info:business_categories(name,slug)",
  "city",
  "photo_url",
  "business_id",
  "created_at",
  "inventory_status",
  "inventory_quantity",
  "low_stock_threshold",
  "inventory_last_updated_at",
].join(",");

function normalizeText(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

async function tryLoadFromPublicListingsView({
  city,
  zip,
  limit,
}: {
  city: string | null;
  zip: string | null;
  limit: number;
}) {
  const supabase = getPublicSupabaseServerClient();
  let query = supabase
    .from("public_listings")
    .select(PUBLIC_LISTING_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (city) {
    query = query.ilike("city", city);
  } else if (zip) {
    query = query.eq("zip", zip);
  }

  const { data, error } = await query;
  if (error) return { data: null, error };
  return { data: (data ?? []) as unknown as ListingSummary[], error: null };
}

async function tryLoadFromListingsTable({
  city,
  zip,
  limit,
}: {
  city: string | null;
  zip: string | null;
  limit: number;
}) {
  const supabase = getPublicSupabaseServerClient();

  const run = async (activeFilter: "is_active" | "status:published" | "status:active") => {
    let query = supabase
      .from("listings")
      .select(PUBLIC_LISTING_SELECT)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (city) {
      query = query.ilike("city", city);
    } else if (zip) {
      query = query.eq("zip", zip);
    }

    if (activeFilter === "is_active") {
      query = query.eq("is_active", true);
    } else if (activeFilter === "status:published") {
      query = query.eq("status", "published");
    } else {
      query = query.eq("status", "active");
    }

    return query;
  };

  const attempts: Array<"is_active" | "status:published" | "status:active"> = [
    "is_active",
    "status:published",
    "status:active",
  ];

  for (const filter of attempts) {
    const { data, error } = await run(filter);
    if (!error) {
      return { data: (data ?? []) as unknown as ListingSummary[], error: null };
    }
  }

  return { data: [] as ListingSummary[], error: "listings_public_query_failed" };
}

async function loadPublicSafeListings({
  city,
  zip,
  limit,
}: {
  city: string | null;
  zip: string | null;
  limit: number;
}) {
  const fromView = await tryLoadFromPublicListingsView({ city, zip, limit });
  if (!fromView.error && fromView.data) return fromView.data;

  const fromTable = await tryLoadFromListingsTable({ city, zip, limit });
  if (!fromTable.error && Array.isArray(fromTable.data)) return fromTable.data;

  // TODO: If anon reads fail due to RLS, add policy allowing SELECT for anon on
  // published listings (or expose a `public_listings` view with that policy).
  return [];
}

export async function getHomeBrowseData({
  mode,
  city,
  zip,
  limit = 80,
}: GetHomeBrowseDataArgs): Promise<HomeBrowseData> {
  void mode;
  const safeCity = normalizeText(city);
  const safeZip = normalizeText(zip);
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 120) : 80;

  let featuredCategories: FeaturedCategory[] = [];
  let featuredCategoriesError: string | null = null;
  try {
    featuredCategories = await fetchFeaturedCategories();
  } catch (error) {
    console.error("Failed to load featured categories:", error);
    featuredCategoriesError = "We couldn't load categories right now.";
  }

  const [listings, banners] = await Promise.all([
    loadPublicSafeListings({
      city: safeCity,
      zip: safeZip,
      limit: safeLimit,
    }),
    fetchStrapiBanners().catch(() => []),
  ]);

  return {
    featuredCategories,
    featuredCategoriesError,
    listings,
    banners: Array.isArray(banners) ? banners : [],
    city: safeCity,
    zip: safeZip,
  };
}
