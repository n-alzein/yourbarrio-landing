import { NextResponse } from "next/server";
import rateLimit from "@/lib/rateLimit";
import { getBusinessDataClientForRequest } from "@/lib/business/getBusinessDataClientForRequest";
import { validateImageFile } from "@/lib/storageUpload";
import {
  enhancePhotoWithPhotoroom,
  type PhotoroomBackgroundMode,
} from "@/lib/server/photoroom";
import {
  getMediaServiceClient,
  MEDIA_BUCKET,
} from "@/lib/images/mediaAssets.server";
import { buildSupabasePublicUrl } from "@/lib/images/resolveMediaAssetUrl";
import {
  BusinessEntitlementError,
  assertBusinessCanUseFeature,
  consumeBusinessUsage,
} from "@/lib/monetization/entitlements";
import { FEATURES } from "@/lib/monetization/features";
import { getSupabaseServerClient as getServiceRoleClient } from "@/lib/supabase/server";

const routeLimiter = rateLimit({ interval: 10 * 60_000, uniqueTokenPerInterval: 200 });
const ALLOWED_BACKGROUNDS = new Set<PhotoroomBackgroundMode>(["original", "white", "soft_gray"]);

function buildDebugPayload(debug: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return undefined;
  return debug;
}

function buildEnhancedPath(sourcePath: string | null) {
  const basePath = String(sourcePath || "").replace(/\/source$/, "");
  if (!basePath || !basePath.startsWith("tmp/")) return null;
  return `${basePath}/enhanced.webp`;
}

export async function POST(request: Request) {
  const access = await getBusinessDataClientForRequest({
    timingLabel: "images-enhance",
  });
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: access.error } }, {
      status: access.status,
    });
  }

  const forwardedFor = request.headers.get("x-forwarded-for") || "unknown";
  const rateToken = `${access.effectiveUserId}:${forwardedFor.split(",")[0]?.trim() || "unknown"}`;

  try {
    routeLimiter.check(6, rateToken);
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many enhancement attempts right now. Try again in a few minutes.",
        },
      },
      { status: 429 }
    );
  }

  try {
    const serviceClient = getServiceRoleClient();
    await assertBusinessCanUseFeature(
      access.businessId,
      FEATURES.AI_PHOTO_ENHANCEMENT,
      serviceClient
    );

    const formData = await request.formData();
    const image = formData.get("image");
    const mediaAssetId = String(formData.get("mediaAssetId") || "").trim();
    const imageSource = String(formData.get("imageSource") || "unknown").trim() || "unknown";
    const imageNormalized = String(formData.get("imageNormalized") || "false").trim() === "true";
    const enhancementAttempt = Number(formData.get("enhancementAttempt") || 1);
    const imageWidth = Number(formData.get("imageWidth") || 0) || null;
    const imageHeight = Number(formData.get("imageHeight") || 0) || null;
    const optimizedWidth = Number(formData.get("optimizedWidth") || 0) || null;
    const optimizedHeight = Number(formData.get("optimizedHeight") || 0) || null;
    const requestedBackground = String(formData.get("background") || "white").trim() as PhotoroomBackgroundMode;
    const background = ALLOWED_BACKGROUNDS.has(requestedBackground)
      ? requestedBackground
      : "white";

    if (!(image instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "INVALID_FILE", message: "Upload a supported image before enhancing it." },
        },
        { status: 400 }
      );
    }

    if (!mediaAssetId) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "MEDIA_ASSET_REQUIRED",
            message: "Upload the image before enhancing it.",
          },
        },
        { status: 400 }
      );
    }

    const mediaClient = getMediaServiceClient();
    const { data: mediaAsset, error: mediaAssetError } = await mediaClient
      .from("media_assets")
      .select("*")
      .eq("id", mediaAssetId)
      .eq("owner_user_id", access.effectiveUserId)
      .eq("status", "temporary")
      .maybeSingle();

    if (mediaAssetError) throw mediaAssetError;
    const path = buildEnhancedPath(mediaAsset?.source_path || mediaAsset?.original_path || null);
    if (!mediaAsset || mediaAsset.bucket !== MEDIA_BUCKET || !path) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "MEDIA_ASSET_NOT_FOUND",
            message: "Temporary upload could not be found.",
          },
        },
        { status: 404 }
      );
    }

    const validation = validateImageFile(image, { maxSizeMB: 8 });
    if (!validation.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "INVALID_FILE", message: validation.error },
        },
        { status: 400 }
      );
    }

    const enhanced = await enhancePhotoWithPhotoroom({
      image,
      background,
      timeoutMs: 20_000,
    });

    if (process.env.NODE_ENV !== "production") {
      console.info("[images.enhance] request_received", {
        userId: access.effectiveUserId,
        source: imageSource,
        inputFileName: image.name || null,
        inputContentType: image.type || null,
        inputByteSize: typeof image.size === "number" ? image.size : null,
        imageNormalized,
        enhancementAttempt,
        imageWidth,
        imageHeight,
        optimizedWidth,
        optimizedHeight,
        background,
      });
    }

    if (!enhanced.transformed) {
      console.warn("[images.enhance] transformed_output_missing", {
        userId: access.effectiveUserId,
        source: imageSource,
        rawFileName: image.name || null,
      });
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "ENHANCEMENT_UNUSABLE",
            message: "We couldn't enhance this photo right now. You can keep the original and continue.",
          },
          debug: buildDebugPayload({
            stage: "provider_response",
            reason: "transformed_output_missing",
            source: imageSource,
            imageNormalized,
            enhancementAttempt,
          }),
        },
        { status: 422 }
      );
    }

    if (process.env.NODE_ENV !== "production") {
      console.info("[images.enhance] upload_metadata", {
        userId: access.effectiveUserId,
        source: imageSource,
        enhancementAttempt,
        enhancedBytesLength: enhanced.buffer.byteLength,
        enhancedContentType: enhanced.contentType,
        targetEnhancedPath: path,
        uploadSource: "transformed_buffer",
      });
    }

    const { error: uploadError } = await mediaClient.storage
      .from(MEDIA_BUCKET)
      .upload(path, new Uint8Array(enhanced.buffer), {
        contentType: enhanced.contentType,
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      console.error("[images.enhance] storage_upload_failed", {
        userId: access.effectiveUserId,
        code: uploadError.code || null,
        message: uploadError.message || null,
        targetEnhancedPath: path,
      });
      throw Object.assign(new Error("Failed to store enhanced image"), {
        stage: "storage_upload",
        uploadCode: uploadError.code || null,
      });
    }

    const { error: updateError } = await mediaClient
      .from("media_assets")
      .update({ enhanced_path: path })
      .eq("id", mediaAsset.id)
      .eq("owner_user_id", access.effectiveUserId)
      .eq("status", "temporary");
    if (updateError) throw updateError;

    await consumeBusinessUsage(
      access.businessId,
      FEATURES.AI_PHOTO_ENHANCEMENT,
      1,
      { mediaAssetId: mediaAsset.id, background },
      serviceClient
    );

    return NextResponse.json(
      {
        ok: true,
        image: {
          publicUrl: buildSupabasePublicUrl(MEDIA_BUCKET, path),
          path,
          contentType: enhanced.contentType,
          isFallbackOriginal: false,
        },
        enhancement: {
          background,
          lighting: enhanced.lighting,
          shadow: enhanced.shadow,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof BusinessEntitlementError) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "FEATURE_LIMIT_REACHED",
            message:
              error.result.reason || "You've reached this month's photo enhancement limit.",
          },
        },
        { status: 429 }
      );
    }

    const typedError = error as Error & { status?: number; requestId?: string | null };
    const debug = buildDebugPayload({
      stage: (typedError as Error & { stage?: string })?.stage || "unknown",
      status: typedError?.status || null,
      requestId: typedError?.requestId || null,
      message: typedError?.message || "Unknown enhancement failure",
    });
    console.error("[images.enhance] request_failed", {
      userId: access.effectiveUserId,
      status: typedError?.status || null,
      requestId: typedError?.requestId || null,
      stage: (typedError as Error & { stage?: string })?.stage || null,
      message: typedError?.message || "Unknown enhancement failure",
    });

    const status =
      typedError?.status === 429
        ? 429
        : typedError?.status === 504
        ? 504
        : typedError?.status && typedError.status >= 400 && typedError.status < 500
        ? 422
        : 502;
    return NextResponse.json(
      {
        ok: false,
        error: {
          code:
            status === 429
              ? "UPSTREAM_RATE_LIMITED"
              : status === 504
              ? "UPSTREAM_TIMEOUT"
              : status === 422
              ? "UNSUPPORTED_INPUT"
              : "ENHANCEMENT_FAILED",
          message: "We couldn't enhance this photo right now. You can keep the original and continue.",
        },
        debug,
      },
      { status }
    );
  }
}
