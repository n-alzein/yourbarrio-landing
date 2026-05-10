import "server-only";

import sharp from "sharp";
import { buildSupabasePublicUrl } from "@/lib/images/resolveMediaAssetUrl";

const WEBP_CONTENT_TYPE = "image/webp";
const DEFAULT_QUALITY = 80;

const VARIANT_CONFIGS = {
  listing_image: {
    sourceMaxWidth: 2200,
    variants: [
      { key: "thumb_path", filename: "thumb_320.webp", width: 320, height: 240, fit: "contain" },
      { key: "card_path", filename: "card_640.webp", width: 640, height: 480, fit: "contain" },
      { key: "detail_path", filename: "detail_1200.webp", width: 1200, fit: "inside" },
    ],
  },
  listing_cover: {
    sourceMaxWidth: 2200,
    variants: [
      { key: "thumb_path", filename: "thumb_320.webp", width: 320, height: 240, fit: "contain" },
      { key: "card_path", filename: "card_640.webp", width: 640, height: 480, fit: "contain" },
      { key: "detail_path", filename: "detail_1200.webp", width: 1200, fit: "inside" },
    ],
  },
  business_cover: {
    sourceMaxWidth: 2200,
    variants: [
      { key: "cover_mobile_path", filename: "cover_mobile_900.webp", width: 900, height: 520, fit: "cover" },
      { key: "cover_desktop_path", filename: "cover_desktop_1600.webp", width: 1600, height: 520, fit: "cover" },
    ],
  },
  business_avatar: {
    sourceMaxWidth: 1024,
    quality: 92,
    withoutEnlargement: true,
    variants: [
      { key: "avatar_128_path", filename: "avatar_128.webp", width: 128, height: 128, fit: "cover" },
      { key: "avatar_256_path", filename: "avatar_256.webp", width: 256, height: 256, fit: "cover" },
      { key: "avatar_512_path", filename: "avatar_512.webp", width: 512, height: 512, fit: "cover" },
    ],
  },
  user_avatar: {
    sourceMaxWidth: 1024,
    variants: [
      { key: "avatar_128_path", filename: "avatar_128.webp", width: 128, height: 128, fit: "cover" },
      { key: "avatar_256_path", filename: "avatar_256.webp", width: 256, height: 256, fit: "cover" },
    ],
  },
  business_gallery: {
    sourceMaxWidth: 2200,
    variants: [
      { key: "thumb_path", filename: "thumb_320.webp", width: 320, height: 240, fit: "cover" },
      { key: "card_path", filename: "card_640.webp", width: 640, height: 480, fit: "cover" },
      { key: "detail_path", filename: "detail_1200.webp", width: 1200, fit: "inside" },
    ],
  },
};

function getConfig(purpose) {
  return VARIANT_CONFIGS[purpose] || VARIANT_CONFIGS.listing_image;
}

async function uploadBuffer(storage, bucket, path, buffer) {
  const { error } = await storage.from(bucket).upload(path, buffer, {
    cacheControl: "31536000",
    contentType: WEBP_CONTENT_TYPE,
    upsert: true,
  });
  if (error) {
    throw new Error(error.message || "Failed to upload image variant");
  }
}

export async function generateAndUploadImageVariants({
  storage,
  bucket,
  sourceBuffer,
  purpose,
  basePath,
  quality = DEFAULT_QUALITY,
}) {
  if (!storage) throw new Error("Storage client is required");
  if (!bucket) throw new Error("Storage bucket is required");
  if (!sourceBuffer) throw new Error("Source image is required");
  if (!basePath) throw new Error("Permanent image path is required");

  const config = getConfig(purpose);
  const outputQuality = config.quality || quality;
  const cleanBasePath = String(basePath).replace(/^\/+|\/+$/g, "");
  const sourcePath = `${cleanBasePath}/source.webp`;
  const sourceImage = sharp(sourceBuffer, { failOn: "none" }).rotate();
  const metadata = await sourceImage.metadata();

  const normalizedSource = await sharp(sourceBuffer, { failOn: "none" })
    .rotate()
    .resize({
      width: config.sourceMaxWidth,
      height: config.sourceMaxWidth,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: outputQuality, smartSubsample: true })
    .toBuffer();

  await uploadBuffer(storage, bucket, sourcePath, normalizedSource);

  const paths = {
    source_path: sourcePath,
    original_path: sourcePath,
    public_url: buildSupabasePublicUrl(bucket, sourcePath),
    width: metadata.width || null,
    height: metadata.height || null,
    mime_type: WEBP_CONTENT_TYPE,
    size_bytes: normalizedSource.byteLength,
  };

  for (const variant of config.variants) {
    const variantPath = `${cleanBasePath}/${variant.filename}`;
    const resized = await sharp(sourceBuffer, { failOn: "none" })
      .rotate()
      .resize({
        width: variant.width,
        height: variant.height,
        fit: variant.fit,
        position: "centre",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
        withoutEnlargement:
          variant.withoutEnlargement ?? config.withoutEnlargement ?? variant.fit !== "cover",
      })
      .webp({ quality: variant.quality || outputQuality, smartSubsample: true })
      .toBuffer();
    await uploadBuffer(storage, bucket, variantPath, resized);
    paths[variant.key] = variantPath;
  }

  return paths;
}
