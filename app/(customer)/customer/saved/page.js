import CustomerSavedClient from "./CustomerSavedClient";
import { getSupabaseServerClient, getUserCached } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
// User-specific saved listings must render per-request to avoid cross-user caching.

async function getSavedListings() {
  const supabase = await getSupabaseServerClient();
  const { user, error: userError } = await getUserCached(supabase);

  if (userError || !user) {
    return { user: null, saved: [], error: userError?.message || null };
  }

  const { data: savedRows, error: savedError } = await supabase
    .from("saved_listings")
    .select("listing_id")
    .eq("user_id", user.id);

  if (savedError) {
    return { user, saved: [], error: savedError.message || "saved_load_failed" };
  }

  const ids = (savedRows || []).map((row) => row.listing_id).filter(Boolean);

  if (ids.length === 0) {
    return { user, saved: [], error: null };
  }

  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select("*, category_info:business_categories(name,slug)")
    .in("id", ids);

  if (listingsError) {
    return {
      user,
      saved: [],
      error: listingsError.message || "saved_listings_load_failed",
    };
  }

  const normalized = (listings || []).map((row) => ({
    ...row,
    category: row.category_info?.name || row.category,
  }));

  return { user, saved: normalized, error: null };
}

export default async function CustomerSavedPage() {
  const { user, saved, error } = await getSavedListings();

  return (
    <CustomerSavedClient
      initialSaved={saved}
      initialUserId={user?.id ?? null}
      initialError={error}
    />
  );
}
