export function extractPhotoUrls(photoField) {
  if (!photoField) return [];

  if (Array.isArray(photoField)) {
    return photoField.map(String).filter(Boolean);
  }

  if (typeof photoField === "string") {
    const trimmed = photoField.trim();
    if (!trimmed) return [];

    // Try JSON array first
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(String).filter(Boolean);
      }
    } catch {
      // fall through to delimiter parsing
    }

    // Comma-delimited fallback
    if (trimmed.includes(",")) {
      return trimmed
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    return [trimmed];
  }

  return [];
}

export function primaryPhotoUrl(photoField) {
  const [first] = extractPhotoUrls(photoField);
  return first || null;
}
