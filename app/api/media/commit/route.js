import { NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabaseServer";
import {
  commitTemporaryMediaAssets,
  mediaAssetToListingPhotoVariant,
  mediaAssetToProfileUrl,
} from "@/lib/images/mediaAssets.server";
import { redactMediaErrorMessage } from "@/lib/images/redactMediaError";

const ALLOWED_PURPOSES = new Set([
  "listing_image",
  "listing_cover",
  "business_cover",
  "business_avatar",
  "business_gallery",
  "user_avatar",
]);

function jsonError(message, status = 400, code = "COMMIT_FAILED") {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(request) {
  const response = NextResponse.next();
  const authClient = createSupabaseRouteHandlerClient(request, response);
  if (!authClient) {
    return jsonError("Server is missing Supabase credentials.", 500, "SERVER_CONFIG");
  }

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();
  if (authError || !user?.id) {
    return jsonError("Unauthorized", 401, "UNAUTHORIZED");
  }

  const body = await request.json().catch(() => ({}));
  const assetIds = Array.isArray(body?.assetIds)
    ? body.assetIds.map(String).filter(Boolean)
    : [];
  const purpose = String(body?.purpose || "").trim();
  const listingId = body?.listingId ? String(body.listingId) : null;
  if (!assetIds.length) return jsonError("No temporary media assets provided.", 400, "NO_ASSETS");
  if (!ALLOWED_PURPOSES.has(purpose)) return jsonError("Unsupported media purpose.", 400, "BAD_PURPOSE");
  if ((purpose === "listing_image" || purpose === "listing_cover") && !listingId) {
    return jsonError("Listing media can only be saved after the listing exists.", 400, "MISSING_LISTING");
  }

  try {
    const assets = await commitTemporaryMediaAssets({
      assetIds,
      businessId: body?.businessId ? String(body.businessId) : user.id,
      listingId,
      purpose,
      ownerUserId: user.id,
      sortOrders: body?.sortOrders && typeof body.sortOrders === "object" ? body.sortOrders : {},
    });

    return NextResponse.json({
      ok: true,
      assets,
      listingPhotoVariants: assets.map(mediaAssetToListingPhotoVariant),
      profileUrl:
        purpose === "business_cover"
          ? mediaAssetToProfileUrl(assets[0], "business_cover_desktop")
          : purpose === "business_avatar" || purpose === "user_avatar"
          ? mediaAssetToProfileUrl(assets[0], "avatar_profile")
          : null,
    });
  } catch (err) {
    const status = Number(err?.status) || 500;
    console.error("[media.commit] failed", {
      userId: user.id,
      purpose,
      count: assetIds.length,
      message: redactMediaErrorMessage(err?.message || String(err)),
    });
    return jsonError(
      status === 404 ? "Temporary upload could not be found." : "Failed to save uploaded image.",
      status,
      status === 404 ? "NOT_FOUND" : "COMMIT_FAILED"
    );
  }
}
