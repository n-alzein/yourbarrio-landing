import {
  DEFAULT_RADIUS_KM,
  filterByLocation,
  getNormalizedLocation,
  hasUsableLocationFilter,
  matchesExactCityState,
} from "@/lib/location/filter";
import { PUBLIC_VERIFIED_BUSINESS_STATUSES } from "@/lib/business/publicBusinessQuery";

const LOCATION_SELECT =
  "id,owner_user_id,public_id,business_name,business_type_id,business_type,category,city,state,postal_code,address,description,website,profile_photo_url,avatar_media_asset_id,business_avatar_media_asset:media_assets!businesses_avatar_media_asset_id_fkey(id,bucket,purpose,status,source_path,original_path,avatar_128_path,avatar_256_path,avatar_512_path,public_url,width,height,mime_type,size_bytes,created_at,updated_at),cover_photo_url,latitude,longitude,lat,lng,verification_status,account_status,deleted_at,created_at,updated_at,is_seeded";

const LEGACY_LOCATION_SELECT =
  "id,owner_user_id,public_id,business_name,business_type_id,business_type,category,city,state,postal_code,address,description,website,profile_photo_url,cover_photo_url,latitude,longitude,lat,lng,verification_status,account_status,deleted_at,created_at,updated_at,is_seeded";

function isAvatarMediaSelectError(error) {
  const code = String(error?.code || "").trim();
  const message = String(error?.message || error?.details || "");
  return (
    code === "42703" ||
    code === "PGRST200" ||
    code === "PGRST201" ||
    /avatar_media_asset_id|media_assets|relationship|foreign key/i.test(message)
  );
}

export async function findBusinessesForLocation(
  supabase,
  location,
  {
    limit = 1000,
    radiusKm = DEFAULT_RADIUS_KM,
    viewerCanSeeInternalContent = false,
    strictCityState = false,
  } = {}
) {
  const normalizedLocation = getNormalizedLocation(location);
  if (!supabase || !hasUsableLocationFilter(normalizedLocation)) {
    return [];
  }

  const buildQuery = (select) =>
    supabase
      .from("businesses")
      .select(select)
      .in("verification_status", PUBLIC_VERIFIED_BUSINESS_STATUSES)
      .eq("account_status", "active")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false, nullsFirst: false });

  let query = buildQuery(LOCATION_SELECT);

  if (!viewerCanSeeInternalContent) {
    query = query.eq("is_internal", false);
  }

  let { data, error } = await query.limit(limit);

  if (error && isAvatarMediaSelectError(error)) {
    query = buildQuery(LEGACY_LOCATION_SELECT);
    if (!viewerCanSeeInternalContent) {
      query = query.eq("is_internal", false);
    }
    ({ data, error } = await query.limit(limit));
  }

  if (error) {
    throw error;
  }

  if (strictCityState) {
    return (data || []).filter((row) => matchesExactCityState(row, normalizedLocation));
  }

  return filterByLocation(data || [], normalizedLocation, { radiusKm });
}

export async function findBusinessOwnerIdsForLocation(supabase, location, options = {}) {
  const businesses = await findBusinessesForLocation(supabase, location, options);
  return Array.from(
    new Set(
      businesses
        .map((row) => row.owner_user_id || row.id || null)
        .filter(Boolean)
    )
  );
}
