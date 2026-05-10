import { resolveMediaAssetUrl } from "@/lib/images/resolveMediaAssetUrl";

export const BUSINESS_GALLERY_MEDIA_SELECT =
  "id,bucket,purpose,status,source_path,original_path,thumb_path,card_path,detail_path,public_url,width,height,mime_type,size_bytes,created_at,updated_at";

export const BUSINESS_GALLERY_LEGACY_SELECT =
  "id,business_id,photo_url,caption,sort_order,created_at";

export const BUSINESS_GALLERY_WITH_MEDIA_SELECT =
  `${BUSINESS_GALLERY_LEGACY_SELECT},media_asset_id,media_asset:media_assets(${BUSINESS_GALLERY_MEDIA_SELECT})`;

export function isBusinessGalleryMediaSelectError(error) {
  if (!error) return false;
  const code = String(error.code || "");
  const message = String(error.message || error.details || "");
  return (
    code === "42703" ||
    code === "PGRST200" ||
    code === "PGRST201" ||
    /media_asset_id|media_assets|relationship|foreign key/i.test(message)
  );
}

function getPhotoMediaAsset(photo) {
  if (!photo || typeof photo !== "object") return null;
  if (photo.media_asset && typeof photo.media_asset === "object") return photo.media_asset;
  if (photo.mediaAsset && typeof photo.mediaAsset === "object") return photo.mediaAsset;
  if (photo.bucket && (photo.card_path || photo.thumb_path || photo.detail_path || photo.source_path)) {
    return photo;
  }
  return null;
}

function getGalleryUseCase(useCase) {
  if (useCase === "thumb") return "business_gallery_thumb";
  if (useCase === "detail" || useCase === "full") return "business_gallery_detail";
  return "business_gallery_card";
}

export function resolveBusinessGalleryImageUrl(
  photo,
  { useCase = "card", fallback = "/business-placeholder.png" } = {}
) {
  if (!photo || typeof photo !== "object") return fallback;
  const assetUrl = resolveMediaAssetUrl(getPhotoMediaAsset(photo), getGalleryUseCase(useCase));
  if (assetUrl) return assetUrl;
  return (
    (typeof photo.photo_url === "string" && photo.photo_url.trim()) ||
    (typeof photo.image_url === "string" && photo.image_url.trim()) ||
    fallback
  );
}

export async function fetchBusinessGalleryPhotos(client, businessId, { limit = null } = {}) {
  if (!client || !businessId) {
    return { data: [], count: 0, error: null };
  }

  const applyFilters = (query) => {
    let next = query
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (Number.isInteger(limit) && limit > 0) {
      next = next.limit(limit);
    }
    return next;
  };

  const withMedia = await applyFilters(
    client.from("business_gallery_photos").select(BUSINESS_GALLERY_WITH_MEDIA_SELECT)
  );

  if (!withMedia?.error || !isBusinessGalleryMediaSelectError(withMedia.error)) {
    return withMedia;
  }

  return applyFilters(
    client.from("business_gallery_photos").select(BUSINESS_GALLERY_LEGACY_SELECT)
  );
}
