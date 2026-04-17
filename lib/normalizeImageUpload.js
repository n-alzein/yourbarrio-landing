const HEIC_MIME_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

const HEIC_EXTENSION_PATTERN = /\.(heic|heif)$/i;
const NORMALIZATION_ERROR_MESSAGE =
  "We couldn’t process this iPhone photo automatically. Please try another photo, or set your iPhone camera format to Most Compatible.";
const ENHANCEMENT_OPTIMIZATION_ERROR_MESSAGE =
  "We couldn’t prepare this photo for enhancement right now. You can keep the original and continue.";
const MAX_ENHANCEMENT_FILE_SIZE = 6 * 1024 * 1024;
const MAX_ENHANCEMENT_DIMENSION = 3000;

function logNormalization(details) {
  if (process.env.NODE_ENV === "production") return;
  console.info("[image.normalize]", details);
}

export function isHeicLike(file) {
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

export function describeImageFile(file) {
  if (!(file instanceof File)) return null;
  return {
    name: file.name || null,
    type: file.type || null,
    size: typeof file.size === "number" ? file.size : null,
  };
}

async function convertHeicToJpeg(file) {
  const { heicTo } = await import("heic-to");
  return heicTo({
    blob: file,
    type: "image/jpeg",
    quality: 0.92,
  });
}

async function detectHeicFromFileSignature(file) {
  const { isHeic } = await import("heic-to");
  return isHeic(file);
}

async function loadImageDimensions(file) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Image metadata load failed"));
      element.src = objectUrl;
    });

    return {
      width: image.naturalWidth || image.width || 0,
      height: image.naturalHeight || image.height || 0,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("Canvas export failed"));
    }, type, quality);
  });
}

export async function normalizeImageUpload(file, options = {}) {
  if (!(file instanceof File)) {
    throw new Error("Select an image to upload.");
  }

  const metadataMatched = isHeicLike(file);
  let heicMatched = metadataMatched;
  let detectionPath = metadataMatched ? "metadata" : "none";

  if (!heicMatched && (!file.type || !file.name)) {
    try {
      heicMatched = await detectHeicFromFileSignature(file);
      detectionPath = heicMatched ? "signature" : "signature-no-match";
    } catch (error) {
      detectionPath = "signature-error";
      logNormalization({
        originalName: file.name || null,
        originalType: file.type || null,
        originalSize: typeof file.size === "number" ? file.size : null,
        heicMatched: false,
        detectionPath,
        conversionErrorMessage: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  const baseDetails = {
    originalName: file.name || null,
    originalType: file.type || null,
    originalSize: typeof file.size === "number" ? file.size : null,
    heicMatched,
    detectionPath,
    source: options?.source || "unknown",
    inputControl: options?.inputControl || "unknown",
    captureAttributePresent: Boolean(options?.captureAttributePresent),
  };

  if (!heicMatched) {
    logNormalization({
      ...baseDetails,
      converterPath: "passthrough",
      normalizedName: file.name || null,
      normalizedType: file.type || null,
      normalizedSize: typeof file.size === "number" ? file.size : null,
    });
    return file;
  }

  try {
    const convertedBlob = await convertHeicToJpeg(file);

    if (!(convertedBlob instanceof Blob)) {
      throw new Error("HEIC conversion returned no blob");
    }

    const normalizedFile = new File([convertedBlob], toJpegFileName(file.name), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });

    logNormalization({
      ...baseDetails,
      converterPath: "heic-to",
      normalizedName: normalizedFile.name,
      normalizedType: normalizedFile.type,
      normalizedSize: normalizedFile.size,
    });

    return normalizedFile;
  } catch (error) {
    logNormalization({
      ...baseDetails,
      converterPath: "heic-to",
      normalizedName: null,
      normalizedType: null,
      normalizedSize: null,
      conversionErrorMessage: error instanceof Error ? error.message : "unknown",
      conversionErrorStack: error instanceof Error ? error.stack || null : null,
    });
    throw new Error(NORMALIZATION_ERROR_MESSAGE);
  }
}

export async function prepareEnhancementImage(file, options = {}) {
  if (!(file instanceof File)) {
    throw new Error("Select an image to upload.");
  }

  const source = options?.source || "unknown";
  const inputControl = options?.inputControl || "unknown";
  const baseDetails = {
    source,
    inputControl,
    originalFileName: file.name || null,
    originalFileType: file.type || null,
    originalFileSize: typeof file.size === "number" ? file.size : null,
  };

  try {
    const dimensions = await loadImageDimensions(file);
    const shouldOptimize =
      file.type !== "image/gif" &&
      (file.size > MAX_ENHANCEMENT_FILE_SIZE ||
        dimensions.width > MAX_ENHANCEMENT_DIMENSION ||
        dimensions.height > MAX_ENHANCEMENT_DIMENSION);

    if (!shouldOptimize) {
      logNormalization({
        ...baseDetails,
        optimizationPath: "passthrough",
        width: dimensions.width || null,
        height: dimensions.height || null,
      });
      return {
        file,
        optimized: false,
        dimensions,
      };
    }

    const imageUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("Image decode failed"));
        element.src = imageUrl;
      });

      const scale = Math.min(
        1,
        MAX_ENHANCEMENT_DIMENSION / Math.max(image.naturalWidth || 1, image.naturalHeight || 1)
      );
      const targetWidth = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
      const targetHeight = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Canvas context unavailable");
      }

      context.drawImage(image, 0, 0, targetWidth, targetHeight);
      const blob = await canvasToBlob(canvas, "image/jpeg", 0.9);
      const optimizedFile = new File([blob], toJpegFileName(file.name), {
        type: "image/jpeg",
        lastModified: Date.now(),
      });

      logNormalization({
        ...baseDetails,
        optimizationPath: "canvas-resize",
        width: dimensions.width || null,
        height: dimensions.height || null,
        optimizedFileName: optimizedFile.name,
        optimizedFileType: optimizedFile.type,
        optimizedFileSize: optimizedFile.size,
        optimizedWidth: targetWidth,
        optimizedHeight: targetHeight,
      });

      return {
        file: optimizedFile,
        optimized: true,
        dimensions,
        optimizedDimensions: {
          width: targetWidth,
          height: targetHeight,
        },
      };
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  } catch (error) {
    logNormalization({
      ...baseDetails,
      optimizationPath: "failed",
      optimizationErrorMessage: error instanceof Error ? error.message : "unknown",
      optimizationErrorStack: error instanceof Error ? error.stack || null : null,
    });
    throw new Error(ENHANCEMENT_OPTIMIZATION_ERROR_MESSAGE);
  }
}
