import { NextResponse } from "next/server";
import { getSupabaseServerClient, getUserCached } from "@/lib/supabaseServer";
import { getPublicBusinessByOwnerId } from "@/lib/business/getPublicBusinessByOwnerId";
import { withListingPricing } from "@/lib/pricing";
import { getListingVariants } from "@/lib/listingOptions";

const UUID_ANY_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function findPublicListingByRef(supabase, listingRef) {
  const normalizedRef = String(listingRef || "").trim();
  if (!normalizedRef) return { listing: null, error: null };

  const isUuidLookup = UUID_ANY_REGEX.test(normalizedRef);
  const directLookup = isUuidLookup
    ? await supabase.from("public_listings_v").select("*").eq("id", normalizedRef).maybeSingle()
    : await supabase
        .from("public_listings_v")
        .select("*")
        .ilike("public_id", normalizedRef)
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

export async function GET(request) {
  try {
    const supabase = await getSupabaseServerClient();
    const { user } = await getUserCached(supabase);
    const { searchParams } = new URL(request.url);
    const listingRef = (searchParams.get("id") || "").trim();

    if (!listingRef) {
      return NextResponse.json({ error: "Missing listing id" }, { status: 400 });
    }

    const { listing, error: listingError } = await findPublicListingByRef(supabase, listingRef);

    if (listingError) {
      console.error("[public listings error]", listingError);
      console.log("[public listings]", { count: 0 });
      const response = NextResponse.json(
        { listing: null, business: null, isSaved: false, listingOptions: null },
        { status: 200 }
      );
      response.headers.set("Cache-Control", "no-store");
      return response;
    }

    if (!listing) {
      console.log("[public listings]", { count: 0 });
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const business = await getPublicBusinessByOwnerId(listing.business_id);
    if (!business) {
      console.log("[public listings]", { count: 1 });
      const response = NextResponse.json(
        {
          listing: withListingPricing(listing),
          business: null,
          isSaved: false,
          listingOptions: null,
        },
        { status: 200 }
      );
      response.headers.set("Cache-Control", "no-store");
      return response;
    }

    let isSaved = false;
    if (user?.id) {
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      const isBusiness = String(profile?.role || "").trim().toLowerCase() === "business";
      if (!isBusiness) {
        const { data: saved } = await supabase
          .from("saved_listings")
          .select("id")
          .eq("user_id", user.id)
          .eq("listing_id", listing.id)
          .maybeSingle();
        isSaved = Boolean(saved);
      }
    }

    let listingOptions = null;
    try {
      listingOptions = await getListingVariants(supabase, listing.id);
    } catch (error) {
      console.error("[public listings error]", error);
    }

    console.log("[public listings]", { count: 1 });
    const response = NextResponse.json(
      {
        listing: withListingPricing(listing),
        business,
        isSaved,
        listingOptions,
      },
      { status: 200 }
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (e) {
    console.error("[public listings fatal]", e);
    console.log("[public listings]", { count: 0 });
    const response = NextResponse.json(
      { listing: null, business: null, isSaved: false, listingOptions: null },
      { status: 200 }
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
