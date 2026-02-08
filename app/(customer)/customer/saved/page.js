import CustomerSavedClient from "./CustomerSavedClient";
import { requireRole } from "@/lib/auth/server";
import { getSupportAwareClient } from "@/lib/support/supportAwareData";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
// User-specific saved listings must render per-request to avoid cross-user caching.

async function getSavedListings() {
  await requireRole("customer");
  const { client, effectiveUserId, supportModeActive } = await getSupportAwareClient({
    expectedRole: "customer",
    feature: "saved-listings",
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
      error: savedError.message || "saved_load_failed",
    };
  }

  const ids = (savedRows || []).map((row) => row.listing_id).filter(Boolean);

  if (ids.length === 0) {
    return { user: { id: effectiveUserId }, supportModeActive, saved: [], error: null };
  }

  const { data: listings, error: listingsError } = await client
    .from("listings")
    .select("*, category_info:business_categories(name,slug)")
    .in("id", ids);

  if (listingsError) {
    return {
      user: { id: effectiveUserId },
      supportModeActive,
      saved: [],
      error: listingsError.message || "saved_listings_load_failed",
    };
  }

  const normalized = (listings || []).map((row) => ({
    ...row,
    category: row.category_info?.name || row.category,
  }));

  return {
    user: { id: effectiveUserId },
    supportModeActive,
    saved: normalized,
    error: null,
  };
}

export default async function CustomerSavedPage() {
  const { user, saved, error, supportModeActive } = await getSavedListings();

  return (
    <CustomerSavedClient
      initialSaved={saved}
      initialUserId={user?.id ?? null}
      initialError={error}
      supportModeActive={Boolean(supportModeActive)}
    />
  );
}
