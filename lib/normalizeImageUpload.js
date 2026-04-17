import heic2any from "heic2any";

const HEIC_MIME_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

const HEIC_EXTENSION_PATTERN = /\.(heic|heif)$/i;
const NORMALIZATION_ERROR_MESSAGE =
  "We couldn't process this iPhone photo. Please try a different image.";

function logNormalization(details) {
  if (process.env.NODE_ENV === "production") return;
  console.info("[image.normalize]", details);
}

export function isHeicLikeFile(file) {
  if (!file) return false;
  const type = typeof file.type === "string" ? file.type.trim().toLowerCase() : "";
  const name = typeof file.name === "string" ? file.name.trim() : "";
  return HEIC_MIME_TYPES.has(type) || HEIC_EXTENSION_PATTERN.test(name);
}

export function toJpegFileName(name = "photo.jpg") {
  const baseName = String(name || "photo")
    .replace(HEIC_EXTENSION_PATTERN, "")
    .replace(/\.[^.]+$/, "");
  return `${baseName || "photo"}.jpg`;
}

function getConvertedBlob(result) {
  if (Array.isArray(result)) {
    return result.find((item) => item instanceof Blob) || null;
  }
  return result instanceof Blob ? result : null;
}

export async function normalizeImageUpload(file) {
  if (!(file instanceof File)) {
    throw new Error("Select an image to upload.");
  }

  if (!isHeicLikeFile(file)) {
    logNormalization({
      originalName: file.name || null,
      originalType: file.type || null,
      normalizedName: file.name || null,
      normalizedType: file.type || null,
      converted: false,
    });
    return file;
  }

  try {
    const converted = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.92,
    });
    const blob = getConvertedBlob(converted);

    if (!blob) {
      throw new Error("HEIC conversion returned no blob");
    }

    const normalizedFile = new File([blob], toJpegFileName(file.name), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });

    logNormalization({
      originalName: file.name || null,
      originalType: file.type || null,
      normalizedName: normalizedFile.name,
      normalizedType: normalizedFile.type,
      converted: true,
    });

    return normalizedFile;
  } catch (error) {
    logNormalization({
      originalName: file.name || null,
      originalType: file.type || null,
      normalizedName: null,
      normalizedType: null,
      converted: false,
      error: error instanceof Error ? error.message : "unknown",
    });
    throw new Error(NORMALIZATION_ERROR_MESSAGE);
  }
}
