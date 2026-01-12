import { getBrowserSupabaseClient } from "@/lib/supabaseClient";

const DEFAULT_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const MAX_DEFAULT_MB = 8;

function buildRandomToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function validateImageFile(file, options = {}) {
  const { maxSizeMB = MAX_DEFAULT_MB, allowedTypes = DEFAULT_ALLOWED_TYPES } =
    options;

  if (!file) {
    return { ok: false, error: "Select an image to upload." };
  }

  if (!allowedTypes.includes(file.type)) {
    return { ok: false, error: "Only JPG, PNG, WEBP, or GIF images are supported." };
  }

  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return { ok: false, error: `Image must be smaller than ${maxSizeMB}MB.` };
  }

  return { ok: true };
}

export async function uploadPublicImage({
  supabase,
  bucket,
  file,
  pathPrefix = "",
  maxSizeMB = MAX_DEFAULT_MB,
  allowedTypes = DEFAULT_ALLOWED_TYPES,
}) {
  const client = supabase ?? getBrowserSupabaseClient();
  if (!client) {
    throw new Error("Storage client not ready. Please try again.");
  }

  const validation = validateImageFile(file, { maxSizeMB, allowedTypes });
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const extension = file.name.split(".").pop() || "jpg";
  const safePrefix = pathPrefix ? `${pathPrefix.replace(/\/+$/, "")}/` : "";
  const fileName = `${safePrefix}${buildRandomToken()}.${extension}`;

  const { error: uploadError } = await client.storage
    .from(bucket)
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg",
    });

  if (uploadError) {
    throw new Error(uploadError.message || "Image upload failed.");
  }

  const { data } = client.storage.from(bucket).getPublicUrl(fileName);

  return {
    publicUrl: data?.publicUrl ?? null,
    path: `${bucket}/${fileName}`,
  };
}
