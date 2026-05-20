import "server-only";

import { getPublicBusinessForListing } from "@/lib/business/getPublicBusinessForListing";
import { withListingPricing } from "@/lib/pricing";
import { getPublicSupabaseServerClient } from "@/lib/supabasePublicServer";

const UUID_ANY_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIMING_ENABLED =
  process.env.NODE_ENV !== "production" && process.env.YB_LISTING_DETAIL_TIMING === "1";

function nowMs() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function logTiming(label, details) {
  if (!TIMING_ENABLED) return;
  console.info("[listing-detail-timing]", label, details);
}

async function findPublicListingByRef(supabase, listingRef) {
  const normalizedRef = String(listingRef || "").trim();
  if (!normalizedRef) return { listing: null, error: null };

  const isUuidLookup = UUID_ANY_REGEX.test(normalizedRef);
  const directLookup = isUuidLookup
    ? await supabase.from("public_listings_v").select("*").eq("id", normalizedRef).maybeSingle()
    : await supabase
        .from("public_listings_v")
        .select("*")
        .eq("public_id", normalizedRef)
        .maybeSingle();

  if (directLookup.error || directLookup.data) {
    return { listing: directLookup.data ?? null, error: directLookup.error ?? null };
  }

  const { data: resolvedRows, error: resolveError } = await supabase.rpc("resolve_listing_ref", {
    p_ref: normalizedRef,
  });
  const resolvedRow = Array.isArray(resolvedRows) ? resolvedRows[0] : null;
  const resolvedListingId = resolvedRow?.id || null;

  if (resolveError || !resolvedListingId) {
    return { listing: null, error: resolveError ?? null };
  }

  const resolvedLookup = await supabase
    .from("public_listings_v")
    .select("*")
    .eq("id", resolvedListingId)
    .maybeSingle();

  return {
    listing: resolvedLookup.data ?? null,
    error: resolvedLookup.error ?? null,
  };
}

export async function getPublicListingDetails(listingRef) {
  const startedAt = nowMs();
  const supabase = getPublicSupabaseServerClient();
  if (!supabase) {
    return {
      listing: null,
      business: null,
      isSaved: false,
      listingOptions: null,
      error: "missing_supabase_client",
      status: 500,
    };
  }

  const listingStartedAt = nowMs();
  const { listing, error: listingError } = await findPublicListingByRef(supabase, listingRef);
  const listingMs = Math.round(nowMs() - listingStartedAt);

  if (listingError) {
    logTiming("lookup_failed", {
      listingRef,
      listingMs,
      totalMs: Math.round(nowMs() - startedAt),
    });
    console.error("[public listing details error]", listingError);
    return {
      listing: null,
      business: null,
      isSaved: false,
      listingOptions: null,
      error: "listing_lookup_failed",
      status: 200,
    };
  }

  if (!listing) {
    logTiming("not_found", {
      listingRef,
      listingMs,
      totalMs: Math.round(nowMs() - startedAt),
    });
    return {
      listing: null,
      business: null,
      isSaved: false,
      listingOptions: null,
      error: "not_found",
      status: 404,
    };
  }

  const businessStartedAt = nowMs();
  const business = await getPublicBusinessForListing(listing, { client: supabase });
  const businessMs = Math.round(nowMs() - businessStartedAt);
  const normalizeStartedAt = nowMs();
  const normalizedListing = withListingPricing(listing);
  const normalizeMs = Math.round(nowMs() - normalizeStartedAt);

  logTiming("resolved", {
    listingRef,
    listingId: listing.id || null,
    listingMs,
    businessMs,
    normalizeMs,
    variantsMs: 0,
    variantsDeferred: true,
    savedStateDeferred: true,
    totalMs: Math.round(nowMs() - startedAt),
  });

  return {
    listing: normalizedListing,
    business,
    isSaved: false,
    listingOptions: null,
    error: null,
    status: 200,
  };
}
