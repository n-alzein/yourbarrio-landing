export async function uploadTemporaryImage({ file, purpose, uploadSessionId }) {
  const formData = new FormData();
  formData.append("file", file, file.name || "image");
  if (purpose) formData.append("purpose", purpose);
  if (uploadSessionId) formData.append("upload_session_id", uploadSessionId);

  const response = await fetch("/api/media/temp-upload", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error?.message || "Image upload failed.");
  }
  return payload;
}

export async function discardTemporaryImages({ assetIds = [], uploadSessionId = null } = {}) {
  const cleanAssetIds = assetIds.filter(Boolean);
  if (!cleanAssetIds.length && !uploadSessionId) return { ok: true, deleted: 0 };
  const response = await fetch("/api/media/discard-temp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      assetIds: cleanAssetIds,
      upload_session_id: uploadSessionId,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error?.message || "Failed to discard temporary upload.");
  }
  return payload;
}

export async function commitTemporaryImages({
  assetIds,
  listingId = null,
  businessId = null,
  purpose,
  sortOrders = {},
}) {
  const response = await fetch("/api/media/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      assetIds,
      listingId,
      businessId,
      purpose,
      sortOrders,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error?.message || "Failed to save uploaded image.");
  }
  return payload;
}
