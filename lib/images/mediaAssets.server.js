import "server-only";

import { getSupabaseServerClient as getServiceRoleClient } from "@/lib/supabase/server";
import { generateAndUploadImageVariants } from "@/lib/images/imageVariants.server";
import { redactMediaErrorMessage } from "@/lib/images/redactMediaError";
import { resolveMediaAssetUrl } from "@/lib/images/resolveMediaAssetUrl";

export const MEDIA_BUCKET = "business-photos";
export const TEMP_UPLOAD_TTL_HOURS = 24;

const LISTING_PURPOSES = new Set(["listing_image", "listing_cover", "business_gallery"]);
const BUSINESS_PURPOSES = new Set(["business_cover", "business_avatar", "user_avatar"]);

export function getMediaServiceClient() {
  const client = getServiceRoleClient();
  if (!client) {
    throw new Error("Media service client is not configured");
  }
  return client;
}

function sanitizePathSegment(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function buildTempMediaPath({ userId, uploadSessionId, assetId }) {
  return `tmp/${sanitizePathSegment(userId)}/${sanitizePathSegment(uploadSessionId)}/${sanitizePathSegment(assetId)}/source`;
}

export function buildPermanentMediaBasePath({ businessOwnerUserId, listingId, assetId, purpose }) {
  const businessPart = sanitizePathSegment(businessOwnerUserId);
  const assetPart = sanitizePathSegment(assetId);
  if (purpose === "business_cover") return `${businessPart}/cover/${assetPart}`;
  if (purpose === "business_avatar" || purpose === "user_avatar") return `${businessPart}/avatar/${assetPart}`;
  if (purpose === "business_gallery") return `${businessPart}/gallery/${assetPart}`;
  return `${businessPart}/listings/${sanitizePathSegment(listingId)}/${assetPart}`;
}

async function getBusinessForOwner(client, ownerUserId) {
  const { data, error } = await client
    .from("businesses")
    .select("id,owner_user_id")
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function validateListingAccess(client, { listingId, ownerUserId }) {
  if (!listingId) return null;
  const { data, error } = await client
    .from("listings")
    .select("id,business_id")
    .eq("id", listingId)
    .eq("business_id", ownerUserId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const err = new Error("Listing not found");
    err.status = 404;
    throw err;
  }
  return data;
}

async function downloadStorageObject(client, bucket, path) {
  const { data, error } = await client.storage.from(bucket).download(path);
  if (error || !data) {
    throw new Error(error?.message || "Failed to read uploaded image");
  }
  return Buffer.from(await data.arrayBuffer());
}

async function removeStoragePaths(client, bucket, paths) {
  const cleanPaths = [...new Set((paths || []).filter(Boolean))];
  if (!cleanPaths.length) return;
  const { error } = await client.storage.from(bucket).remove(cleanPaths);
  if (error) {
    console.warn("[media_assets] storage_remove_failed", {
      bucket,
      count: cleanPaths.length,
      message: redactMediaErrorMessage(error.message || String(error)),
    });
  }
}

export function getMediaAssetStoragePaths(asset) {
  return [
    asset?.source_path,
    asset?.original_path,
    asset?.enhanced_path,
    asset?.thumb_path,
    asset?.card_path,
    asset?.detail_path,
    asset?.cover_mobile_path,
    asset?.cover_desktop_path,
    asset?.avatar_128_path,
    asset?.avatar_256_path,
  ];
}

export async function discardTemporaryMediaAssets({ ownerUserId, assetIds = [], uploadSessionId = null }) {
  const client = getMediaServiceClient();
  let query = client
    .from("media_assets")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .eq("status", "temporary");

  if (assetIds.length) {
    query = query.in("id", assetIds);
  } else if (uploadSessionId) {
    query = query.eq("upload_session_id", uploadSessionId);
  } else {
    return { deleted: 0 };
  }

  const { data: assets, error } = await query;
  if (error) throw error;

  for (const asset of assets || []) {
    await removeStoragePaths(client, asset.bucket, [
      ...getMediaAssetStoragePaths(asset),
    ]);
  }

  if (assets?.length) {
    const { error: updateError } = await client
      .from("media_assets")
      .update({ status: "deleted", deleted_at: new Date().toISOString() })
      .in("id", assets.map((asset) => asset.id));
    if (updateError) throw updateError;
  }

  return { deleted: assets?.length || 0 };
}

export async function commitTemporaryMediaAssets({
  assetIds,
  businessId,
  listingId = null,
  purpose,
  ownerUserId,
  sortOrders = {},
}) {
  if (!Array.isArray(assetIds) || !assetIds.length) return [];
  if (!ownerUserId) throw new Error("Missing owner user id");
  if (!purpose) throw new Error("Missing media purpose");

  const client = getMediaServiceClient();
  const business = await getBusinessForOwner(client, ownerUserId);
  if (!business) {
    const err = new Error("Business profile not found");
    err.status = 404;
    throw err;
  }

  if (LISTING_PURPOSES.has(purpose)) {
    await validateListingAccess(client, { listingId, ownerUserId });
  }
  if (businessId && businessId !== ownerUserId && businessId !== business.id) {
    const err = new Error("Business access denied");
    err.status = 403;
    throw err;
  }
  if (!LISTING_PURPOSES.has(purpose) && !BUSINESS_PURPOSES.has(purpose)) {
    const err = new Error("Unsupported media purpose");
    err.status = 400;
    throw err;
  }

  const { data: assets, error } = await client
    .from("media_assets")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .eq("status", "temporary")
    .in("id", assetIds);
  if (error) throw error;

  const byId = new Map((assets || []).map((asset) => [asset.id, asset]));
  if (byId.size !== assetIds.length) {
    const err = new Error("One or more temporary uploads could not be found");
    err.status = 404;
    throw err;
  }

  const committed = [];
  for (const assetId of assetIds) {
    const asset = byId.get(assetId);
    try {
      const tempPath = asset.source_path || asset.original_path;
      const enhancedTempPath = asset.enhanced_path || null;
      const sourceBuffer = await downloadStorageObject(
        client,
        asset.bucket,
        enhancedTempPath || tempPath
      );
      const basePath = buildPermanentMediaBasePath({
        businessOwnerUserId: ownerUserId,
        listingId,
        assetId,
        purpose,
      });
      const variants = await generateAndUploadImageVariants({
        storage: client.storage,
        bucket: asset.bucket,
        sourceBuffer,
        purpose,
        basePath,
      });

      const updatePayload = {
        ...variants,
        purpose,
        status: "active",
        business_id: business.id,
        listing_id: listingId || null,
        enhanced_path: enhancedTempPath ? variants.source_path : null,
        sort_order: Number.isInteger(sortOrders?.[assetId]) ? sortOrders[assetId] : asset.sort_order,
        expires_at: null,
        committed_at: new Date().toISOString(),
      };

      const { data: updated, error: updateError } = await client
        .from("media_assets")
        .update(updatePayload)
        .eq("id", asset.id)
        .eq("status", "temporary")
        .select("*")
        .single();
      if (updateError) throw updateError;

      await removeStoragePaths(client, asset.bucket, [tempPath, enhancedTempPath]);
      committed.push(updated);
    } catch (err) {
      console.error("[media_assets] commit_failed", {
        assetId,
        ownerUserId,
        purpose,
        message: redactMediaErrorMessage(err?.message || String(err)),
      });
      await client
        .from("media_assets")
        .update({ status: "failed" })
        .eq("id", asset.id)
        .eq("owner_user_id", ownerUserId);
      throw err;
    }
  }

  return committed;
}

export async function markMediaAssetsReplaced({ ownerUserId, activeAssetIds = [] }) {
  const ids = activeAssetIds.filter(Boolean);
  if (!ids.length) return { replaced: 0 };
  const client = getMediaServiceClient();
  const { error } = await client
    .from("media_assets")
    .update({ status: "replaced", replaced_at: new Date().toISOString() })
    .eq("owner_user_id", ownerUserId)
    .eq("status", "active")
    .in("id", ids);
  if (error) throw error;
  return { replaced: ids.length };
}

export function mediaAssetToListingPhotoVariant(asset) {
  const sourceUrl = resolveMediaAssetUrl(asset, "listing_detail");
  const enhancedUrl = asset?.enhanced_path
    ? resolveMediaAssetUrl({ ...asset, source_path: asset.enhanced_path }, "original")
    : null;
  return {
    id: asset.id,
    media_asset_id: asset.id,
    original: {
      url: sourceUrl,
      path: asset.detail_path || asset.source_path || asset.original_path || null,
    },
    variants: {
      thumb_320: resolveMediaAssetUrl(asset, "listing_thumb"),
      card_640: resolveMediaAssetUrl(asset, "listing_card"),
      detail_1200: resolveMediaAssetUrl(asset, "listing_detail"),
    },
    enhanced: enhancedUrl
      ? {
          url: enhancedUrl,
          path: asset.enhanced_path,
        }
      : null,
    selectedVariant: "original",
  };
}

export function mediaAssetToProfileUrl(asset, useCase) {
  return resolveMediaAssetUrl(asset, useCase || "original") || asset.public_url || null;
}

export function mediaAssetToBusinessGalleryPhoto(asset) {
  return {
    media_asset_id: asset?.id || null,
    photo_url:
      resolveMediaAssetUrl(asset, "business_gallery_detail") ||
      resolveMediaAssetUrl(asset, "business_gallery_card") ||
      asset?.public_url ||
      null,
    variants: {
      thumb_320: resolveMediaAssetUrl(asset, "business_gallery_thumb"),
      card_640: resolveMediaAssetUrl(asset, "business_gallery_card"),
      detail_1200: resolveMediaAssetUrl(asset, "business_gallery_detail"),
    },
  };
}
