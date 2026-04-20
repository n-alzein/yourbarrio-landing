import CustomerSavedClient from "./CustomerSavedClient";
import { requireRole } from "@/lib/auth/server";
import { getSupportAwareClient } from "@/lib/support/supportAwareData";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
// User-specific saved entities must render per-request to avoid cross-user caching.

async function getSavedData() {
  await requireRole("customer");
  const { client, effectiveUserId, supportModeActive } = await getSupportAwareClient({
    expectedRole: "customer",
    feature: "saved",
  });

  const { data: savedRows, error: savedError } = await client
    .from("saved_listings")
    .select("listing_id")
    .eq("user_id", effectiveUserId);

  if (savedError) {
    return {
      user: { id: effectiveUserId },
      supportModeActive,
      saved: [],
      savedShops: [],
      error: savedError.message || "saved_load_failed",
    };
  }

  const ids = (savedRows || []).map((row) => row.listing_id).filter(Boolean);
  let listings = [];

  if (ids.length > 0) {
    const { data, error: listingsError } = await client
      .from("listings")
      .select("*")
      .in("id", ids);

    if (listingsError) {
      return {
        user: { id: effectiveUserId },
        supportModeActive,
        saved: [],
        savedShops: [],
        error: listingsError.message || "saved_listings_load_failed",
      };
    }
    listings = data || [];
  }

  const { data: savedShopRows, error: savedShopError } = await client
    .from("saved_businesses")
    .select("business_id")
    .eq("user_id", effectiveUserId);

  if (savedShopError) {
    return {
      user: { id: effectiveUserId },
      supportModeActive,
      saved: listings,
      savedShops: [],
      error: savedShopError.message || "saved_shops_load_failed",
    };
  }

  const shopIds = (savedShopRows || []).map((row) => row.business_id).filter(Boolean);
  let savedShops = [];

  if (shopIds.length > 0) {
    const { data, error: shopsError } = await client
      .from("businesses")
      .select("id,owner_user_id,public_id,business_name,business_type,category,city,state,address,description,website,profile_photo_url,cover_photo_url,verification_status,created_at,updated_at")
      .in("owner_user_id", shopIds);

    if (shopsError) {
      return {
        user: { id: effectiveUserId },
        supportModeActive,
        saved: listings,
        savedShops: [],
        error: shopsError.message || "saved_shops_load_failed",
      };
    }
    savedShops = data || [];
  }

  return {
    user: { id: effectiveUserId },
    supportModeActive,
    saved: listings,
    savedShops,
    error: null,
  };
}

export default async function CustomerSavedPage() {
  const { user, saved, savedShops, error, supportModeActive } = await getSavedData();

  return (
    <CustomerSavedClient
      initialSaved={saved}
      initialSavedShops={savedShops}
      initialUserId={user?.id ?? null}
      initialError={error}
      supportModeActive={Boolean(supportModeActive)}
    />
  );
}
