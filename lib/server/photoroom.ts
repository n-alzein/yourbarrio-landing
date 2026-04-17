import "server-only";

export type PhotoroomBackgroundMode = "original" | "white" | "soft_gray";

export type EnhancePhotoOptions = {
  image: File;
  background: PhotoroomBackgroundMode;
  timeoutMs?: number;
};

export type EnhancePhotoResult = {
  buffer: ArrayBuffer;
  contentType: string;
  extension: string;
  background: PhotoroomBackgroundMode;
  lighting: "auto";
  shadow: "subtle";
  transformed: boolean;
};

type PhotoroomRequestError = Error & {
  status?: number;
  requestId?: string | null;
  responseBody?: string;
  stage?: string;
};

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_API_URL = "https://image-api.photoroom.com/v2/edit";
const DEFAULT_OUTPUT_SIZE = "originalImage";
const MAX_ASPECT_RATIO_DELTA = 0.01;

const BACKGROUND_COLOR_MAP: Record<
  Exclude<PhotoroomBackgroundMode, "original">,
  string
> = {
  white: "FFFFFF",
  soft_gray: "F3F4F6",
};

export function getPhotoroomApiUrl() {
  return process.env.PHOTOROOM_API_URL || DEFAULT_API_URL;
}

export function getPhotoroomApiKey() {
  return process.env.PHOTOROOM_API_KEY || "";
}

export function getPhotoroomOutputExtension(contentType: string) {
  const normalized = contentType.toLowerCase();

  if (normalized.includes("png")) return "png";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";

  return "png";
}

export function buildPhotoroomEditFormData({
  image,
  background,
}: EnhancePhotoOptions) {
  const formData = new FormData();

  formData.append("imageFile", image, image.name || "listing-photo.jpg");
  formData.append("padding", "0");
  formData.append("fit", "contain");
  formData.append("outputSize", DEFAULT_OUTPUT_SIZE);
  formData.append("lighting.mode", "ai.auto");

  if (background === "original") {
    formData.append("removeBackground", "false");
  } else {
    formData.append("removeBackground", "true");
    formData.append("background.color", BACKGROUND_COLOR_MAP[background]);
    formData.append("shadow.mode", "ai.soft");
  }

  return formData;
}

async function getImageAspectRatio(image: ArrayBuffer) {
  const sharpModule = await import("sharp");
  const sharp = sharpModule.default;
  const metadata = await sharp(Buffer.from(image)).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;

  if (!width || !height) {
    throw new Error("Unable to read image dimensions");
  }

  return width / height;
}

function buildPhotoroomError(
  message: string,
  options?: {
    status?: number;
    requestId?: string | null;
    responseBody?: string;
    stage?: string;
  }
): PhotoroomRequestError {
  const error = new Error(message) as PhotoroomRequestError;
  error.status = options?.status;
  error.requestId = options?.requestId ?? null;
  error.responseBody = options?.responseBody;
  error.stage = options?.stage;
  return error;
}

function isTransientStatus(status?: number) {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function enhancePhotoWithPhotoroom({
  image,
  background,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: EnhancePhotoOptions): Promise<EnhancePhotoResult> {
  const apiKey = getPhotoroomApiKey();

  if (!apiKey) {
    throw buildPhotoroomError("Photoroom API key is not configured", {
      status: 500,
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const originalBuffer = await image.arrayBuffer();

  try {
    if (process.env.NODE_ENV !== "production") {
      console.info("[photoroom] request_start", {
        fileName: image.name || null,
        contentType: image.type || null,
        byteSize: image.size || null,
        background,
      });
    }

    let response: Response | null = null;
    let attempt = 0;
    const maxAttempts = 2;
    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        response = await fetch(getPhotoroomApiUrl(), {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
          },
          body: buildPhotoroomEditFormData({ image, background }),
          signal: controller.signal,
          cache: "no-store",
        });
      } catch (error) {
        if ((error as Error)?.name === "AbortError") {
          if (attempt < maxAttempts) {
            await sleep(250);
            continue;
          }
          throw buildPhotoroomError("Photoroom request timed out", {
            status: 504,
            stage: "provider_timeout",
          });
        }
        throw error;
      }

      if (!response.ok && isTransientStatus(response.status) && attempt < maxAttempts) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[photoroom] transient_retry", {
            attempt,
            status: response.status,
          });
        }
        await sleep(250);
        continue;
      }

      break;
    }

    if (!response) {
      throw buildPhotoroomError("Photoroom request failed", {
        status: 502,
        stage: "provider_unknown",
      });
    }

    if (!response.ok) {
      const requestId =
        response.headers.get("x-request-id") ||
        response.headers.get("request-id") ||
        null;

      const responseBody = await response.text().catch(() => "");

      console.error("Photoroom request failed", {
        status: response.status,
        requestId,
        url: getPhotoroomApiUrl(),
        responseBody: responseBody.slice(0, 500),
      });

      throw buildPhotoroomError("Photoroom request failed", {
        status: response.status,
        requestId,
        responseBody,
        stage: "provider_response",
      });
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const buffer = await response.arrayBuffer();
    if (process.env.NODE_ENV !== "production") {
      console.info("[photoroom] response_success", {
        upstreamStatus: response.status,
        upstreamContentType: response.headers.get("content-type") || null,
        upstreamContentLength: response.headers.get("content-length") || null,
        returnedContentType: contentType,
        returnedByteLength: buffer.byteLength,
      });
    }

    try {
      const [originalAspectRatio, enhancedAspectRatio] = await Promise.all([
        getImageAspectRatio(originalBuffer),
        getImageAspectRatio(buffer),
      ]);

      if (Math.abs(originalAspectRatio - enhancedAspectRatio) > MAX_ASPECT_RATIO_DELTA) {
        console.warn("Photoroom framing safeguard triggered; using original image", {
          originalAspectRatio,
          enhancedAspectRatio,
          background,
        });

        return {
          buffer: originalBuffer,
          contentType: image.type || "image/png",
          extension: getPhotoroomOutputExtension(image.type || "image/png"),
          background,
          lighting: "auto",
          shadow: "subtle",
          transformed: false,
        };
      }
    } catch (metadataError) {
      console.warn("Photoroom aspect-ratio check skipped", {
        message: metadataError instanceof Error ? metadataError.message : "Unknown metadata error",
      });
    }

    return {
      buffer,
      contentType,
      extension: getPhotoroomOutputExtension(contentType),
      background,
      lighting: "auto",
      shadow: "subtle",
      transformed: true,
    };
  } catch (error) {
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
