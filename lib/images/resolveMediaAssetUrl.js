const VARIANT_FIELDS = {
  listing_thumb: ["thumb_path", "card_path", "detail_path", "source_path", "original_path", "public_url"],
  listing_card: ["card_path", "thumb_path", "detail_path", "source_path", "original_path", "public_url"],
  listing_detail: ["detail_path", "card_path", "source_path", "original_path", "public_url"],
  business_gallery_thumb: ["thumb_path", "card_path", "detail_path", "source_path", "original_path", "public_url"],
  business_gallery_card: ["card_path", "thumb_path", "detail_path", "source_path", "original_path", "public_url"],
  business_gallery_detail: ["detail_path", "card_path", "source_path", "original_path", "public_url"],
  business_cover_mobile: ["cover_mobile_path", "cover_desktop_path", "source_path", "original_path", "public_url"],
  business_cover_desktop: ["cover_desktop_path", "cover_mobile_path", "source_path", "original_path", "public_url"],
  avatar_small: ["avatar_128_path", "avatar_256_path", "avatar_512_path", "source_path", "original_path", "public_url"],
  avatar_profile: ["avatar_512_path", "avatar_256_path", "avatar_128_path", "source_path", "original_path", "public_url"],
  original: ["source_path", "original_path", "public_url"],
};

function getSupabasePublicStorageBase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  return `${url.replace(/\/$/, "")}/storage/v1/object/public`;
}

export function buildSupabasePublicUrl(bucket, path) {
  const cleanBucket = String(bucket || "").trim().replace(/^\/+|\/+$/g, "");
  const cleanPath = String(path || "").trim().replace(/^\/+/, "");
  if (!cleanPath) return null;
  if (/^(https?:\/\/|data:|blob:)/i.test(cleanPath)) return cleanPath;

  const base = getSupabasePublicStorageBase();
  if (!base) {
    return cleanBucket ? `/${cleanBucket}/${cleanPath}` : `/${cleanPath}`;
  }
  return cleanBucket ? `${base}/${cleanBucket}/${cleanPath}` : `${base}/${cleanPath}`;
}

export function resolveMediaAssetUrl(asset, useCase = "original", fallback = null) {
  if (!asset || typeof asset !== "object") return fallback || null;
  const fields = VARIANT_FIELDS[useCase] || VARIANT_FIELDS.original;
  for (const field of fields) {
    const value = typeof asset[field] === "string" ? asset[field].trim() : "";
    if (!value) continue;
    if (field === "public_url") return value;
    return buildSupabasePublicUrl(asset.bucket, value) || fallback || null;
  }
  return fallback || null;
}

export function resolveVariantPath(asset, useCase = "original") {
  if (!asset || typeof asset !== "object") return null;
  const fields = VARIANT_FIELDS[useCase] || VARIANT_FIELDS.original;
  for (const field of fields) {
    if (field === "public_url") continue;
    const value = typeof asset[field] === "string" ? asset[field].trim() : "";
    if (value) return value;
  }
  return null;
}

export function isSavedMediaVariantUrl(value) {
  const src = String(value || "").trim();
  if (!src) return false;
  let path = src;
  try {
    path = new URL(src, "https://yourbarrio.local").pathname;
  } catch {}
  return (
    /\/storage\/v1\/object\/public\/business-photos\/.+\.webp$/i.test(path) ||
    /^\/?business-photos\/.+\.webp$/i.test(path)
  );
}
