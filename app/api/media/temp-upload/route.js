import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabaseServer";
import {
  buildTempMediaPath,
  MEDIA_BUCKET,
  TEMP_UPLOAD_TTL_HOURS,
  getMediaServiceClient,
} from "@/lib/images/mediaAssets.server";
import { redactMediaErrorMessage } from "@/lib/images/redactMediaError";
import { buildSupabasePublicUrl } from "@/lib/images/resolveMediaAssetUrl";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const REJECTED_GRACEFUL_TYPES = new Set(["image/heic", "image/heif"]);
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_PURPOSES = new Set([
  "listing_image",
  "listing_cover",
  "business_cover",
  "business_avatar",
  "business_gallery",
  "user_avatar",
  "temp_upload",
]);

function jsonError(message, status = 400, code = "MEDIA_UPLOAD_FAILED") {
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

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file") || formData?.get("image");
  if (!(file instanceof File)) {
    return jsonError("Upload an image file.", 400, "INVALID_FILE");
  }

  const contentType = String(file.type || "").toLowerCase();
  if (REJECTED_GRACEFUL_TYPES.has(contentType)) {
    return jsonError("HEIC images are not supported here yet. Convert to JPG or PNG and try again.", 415, "UNSUPPORTED_HEIC");
  }
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    return jsonError("Only JPG, PNG, or WEBP images are supported.", 415, "UNSUPPORTED_TYPE");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return jsonError("Image must be smaller than 8MB.", 413, "FILE_TOO_LARGE");
  }

  const requestedPurpose = String(formData?.get("purpose") || "temp_upload").trim();
  const purpose = ALLOWED_PURPOSES.has(requestedPurpose) ? requestedPurpose : "temp_upload";
  const uploadSessionId =
    String(formData?.get("upload_session_id") || "").trim() || randomUUID();
  const assetId = randomUUID();
  const sourcePath = buildTempMediaPath({
    userId: user.id,
    uploadSessionId,
    assetId,
  });
  const expiresAt = new Date(Date.now() + TEMP_UPLOAD_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const serviceClient = getMediaServiceClient();

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await serviceClient.storage
      .from(MEDIA_BUCKET)
      .upload(sourcePath, buffer, {
        cacheControl: "86400",
        contentType,
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data: asset, error: insertError } = await serviceClient
      .from("media_assets")
      .insert({
        id: assetId,
        owner_user_id: user.id,
        purpose,
        status: "temporary",
        bucket: MEDIA_BUCKET,
        source_path: sourcePath,
        original_path: sourcePath,
        public_url: buildSupabasePublicUrl(MEDIA_BUCKET, sourcePath),
        size_bytes: file.size,
        mime_type: contentType,
        upload_session_id: uploadSessionId,
        expires_at: expiresAt,
      })
      .select("*")
      .single();
    if (insertError) throw insertError;

    let previewUrl = asset.public_url;
    const signed = await serviceClient.storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(sourcePath, TEMP_UPLOAD_TTL_HOURS * 60 * 60);
    if (!signed.error && signed.data?.signedUrl) {
      previewUrl = signed.data.signedUrl;
    }

    return NextResponse.json({
      ok: true,
      asset: {
        id: asset.id,
        bucket: asset.bucket,
        source_path: asset.source_path,
        status: asset.status,
        purpose: asset.purpose,
        upload_session_id: asset.upload_session_id,
        expires_at: asset.expires_at,
      },
      previewUrl,
      upload_session_id: uploadSessionId,
    });
  } catch (err) {
    console.error("[media.temp-upload] failed", {
      userId: user.id,
      uploadSessionId,
      message: redactMediaErrorMessage(err?.message || String(err)),
    });
    await serviceClient.storage.from(MEDIA_BUCKET).remove([sourcePath]).catch?.(() => {});
    return jsonError("Image upload failed. Please try again.", 500, "UPLOAD_FAILED");
  }
}
