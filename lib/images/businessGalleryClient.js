import { resolveBusinessGalleryImageUrl } from "@/lib/businessGalleryPhotos";
import {
  commitTemporaryImages,
  discardTemporaryImages,
  uploadTemporaryImage,
} from "@/lib/images/tempMediaClient";

function isMissingMediaAssetColumn(error) {
  const message = String(error?.message || error?.details || "");
  return error?.code === "42703" || /media_asset_id/i.test(message);
}

export async function createBusinessGalleryPhotoRecord({
  supabase,
  businessId,
  mediaAsset,
  photoUrl,
  caption = null,
  sortOrder = 0,
}) {
  if (!supabase) throw new Error("Storage is not ready. Please refresh and try again.");
  if (!businessId) throw new Error("Business profile not ready. Refresh and try again.");

  const payload = {
    business_id: businessId,
    photo_url: photoUrl,
    caption,
    sort_order: sortOrder,
    media_asset_id: mediaAsset?.id || null,
  };

  let result = await supabase
    .from("business_gallery_photos")
    .insert(payload)
    .select("*")
    .single();

  if (result.error && payload.media_asset_id && isMissingMediaAssetColumn(result.error)) {
    const legacyPayload = { ...payload };
    delete legacyPayload.media_asset_id;
    result = await supabase
      .from("business_gallery_photos")
      .insert(legacyPayload)
      .select("*")
      .single();
  }

  if (result.error) throw result.error;
  return mediaAsset ? { ...result.data, media_asset: mediaAsset } : result.data;
}

export async function uploadBusinessGalleryPhoto({ supabase, businessId, file }) {
  let tempAssetId = null;
  let committedAsset = null;

  try {
    const tempUpload = await uploadTemporaryImage({
      file,
      purpose: "business_gallery",
    });
    tempAssetId = tempUpload?.asset?.id || null;

    const committed = await commitTemporaryImages({
      assetIds: [tempAssetId],
      businessId,
      purpose: "business_gallery",
    });
    committedAsset = committed?.assets?.[0] || null;
    if (!committedAsset?.id) {
      throw new Error("Upload failed to return a saved image.");
    }

    const photoUrl = resolveBusinessGalleryImageUrl(
      { media_asset: committedAsset },
      { useCase: "detail", fallback: committedAsset.public_url || null }
    );

    return createBusinessGalleryPhotoRecord({
      supabase,
      businessId,
      mediaAsset: committedAsset,
      photoUrl,
      caption: null,
      sortOrder: 0,
    });
  } catch (error) {
    if (tempAssetId && !committedAsset) {
      await discardTemporaryImages({ assetIds: [tempAssetId] }).catch(() => {});
    }
    throw error;
  }
}
