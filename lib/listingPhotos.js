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

function parseJsonValue(value) {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
}

function normalizeStoredAsset(asset) {
  if (!asset || typeof asset !== "object") return null;
  const url = typeof asset.url === "string" ? asset.url.trim() : "";
  if (!url) return null;
  const path = typeof asset.path === "string" ? asset.path.trim() : "";
  return {
    url,
    path: path || null,
  };
}

function normalizeStoredVariantEntry(entry, fallbackUrl) {
  if (!entry || typeof entry !== "object") {
    const url = typeof fallbackUrl === "string" ? fallbackUrl.trim() : "";
    return url
      ? {
          original: { url, path: null },
          enhanced: null,
          selectedVariant: "original",
        }
      : null;
  }

  const original = normalizeStoredAsset(entry.original);
  const enhancedBase = normalizeStoredAsset(entry.enhanced);
  const enhanced = enhancedBase
    ? {
        ...enhancedBase,
        background:
          typeof entry.enhanced?.background === "string"
            ? entry.enhanced.background
            : "white",
        lighting:
          typeof entry.enhanced?.lighting === "string"
            ? entry.enhanced.lighting
            : "auto",
        shadow:
          typeof entry.enhanced?.shadow === "string"
            ? entry.enhanced.shadow
            : "subtle",
      }
    : null;
  const selectedVariant =
    entry.selectedVariant === "enhanced" && enhanced ? "enhanced" : "original";

  if (!original && !enhanced) {
    const url = typeof fallbackUrl === "string" ? fallbackUrl.trim() : "";
    if (!url) return null;
    return {
      original: { url, path: null },
      enhanced: null,
      selectedVariant: "original",
    };
  }

  return {
    original:
      original ||
      (enhanced && selectedVariant === "enhanced" ? { url: enhanced.url, path: null } : null),
    enhanced,
    selectedVariant,
  };
}

export function getSelectedPhotoUrl(variant) {
  if (!variant || typeof variant !== "object") return null;
  if (variant.selectedVariant === "enhanced" && variant.enhanced?.url) {
    return variant.enhanced.url;
  }
  return variant.original?.url || variant.enhanced?.url || null;
}

export function getListingPhotoVariants(listing) {
  if (!listing || typeof listing !== "object") return [];
  return extractStoredPhotoVariants(listing.photo_url, listing.photo_variants);
}

export function getListingPrimaryPhotoUrl(listing) {
  const [firstVariant] = getListingPhotoVariants(listing);
  const variantUrl = getSelectedPhotoUrl(firstVariant);
  if (variantUrl) return variantUrl;
  return primaryPhotoUrl(listing?.photo_url) || null;
}

export function getListingPhotoUrls(listing) {
  const variantUrls = getListingPhotoVariants(listing)
    .map((variant) => getSelectedPhotoUrl(variant))
    .filter(Boolean);

  if (variantUrls.length) return variantUrls;

  return extractPhotoUrls(listing?.photo_url);
}

export function extractStoredPhotoVariants(photoField, variantsField) {
  const photoUrls = extractPhotoUrls(photoField);
  const parsed = parseJsonValue(variantsField);
  const rawEntries = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.photos)
    ? parsed.photos
    : [];

  const variants = rawEntries
    .map((entry, index) => normalizeStoredVariantEntry(entry, photoUrls[index]))
    .filter(Boolean);

  if (variants.length) {
    return variants;
  }

  return photoUrls
    .map((url) => normalizeStoredVariantEntry(null, url))
    .filter(Boolean);
}

export function serializeStoredPhotoVariants(variants) {
  if (!Array.isArray(variants)) return [];

  return variants
    .map((variant) => {
      const original = normalizeStoredAsset(variant?.original);
      const enhancedBase = normalizeStoredAsset(variant?.enhanced);
      const enhanced = enhancedBase
        ? {
            ...enhancedBase,
            background:
              typeof variant?.enhanced?.background === "string"
                ? variant.enhanced.background
                : "white",
            lighting:
              typeof variant?.enhanced?.lighting === "string"
                ? variant.enhanced.lighting
                : "auto",
            shadow:
              typeof variant?.enhanced?.shadow === "string"
                ? variant.enhanced.shadow
                : "subtle",
          }
        : null;

      if (!original && !enhanced) return null;

      return {
        original:
          original ||
          (enhanced ? { url: enhanced.url, path: enhanced.path || null } : null),
        enhanced,
        selectedVariant:
          variant?.selectedVariant === "enhanced" && enhanced ? "enhanced" : "original",
      };
    })
    .filter(Boolean);
}
