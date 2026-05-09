export function extractPhotoUrls(photoField) {
  if (!photoField) return [];

  if (Array.isArray(photoField)) {
    return photoField.map(String).filter(Boolean);
  }

  if (typeof photoField === "string") {
    const trimmed = photoField.trim();
    if (!trimmed) return [];

    // Full URLs and site-relative asset paths may legitimately contain commas.
    // Treat them as single values instead of splitting on commas.
    if (
      /^(https?:\/\/|data:|blob:)/i.test(trimmed) ||
      /^\/(images|listing-placeholder\.png|business-placeholder\.png|customer-placeholder\.png)/i.test(
        trimmed
      )
    ) {
      return [trimmed];
    }

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
  const url =
    typeof asset.url === "string"
      ? asset.url.trim()
      : typeof asset.publicUrl === "string"
        ? asset.publicUrl.trim()
        : typeof asset.public_url === "string"
          ? asset.public_url.trim()
          : "";
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
          id: null,
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
      id: typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : null,
      original: { url, path: null },
      enhanced: null,
      selectedVariant: "original",
    };
  }

  return {
    id: typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : null,
    media_asset_id:
      typeof entry.media_asset_id === "string" && entry.media_asset_id.trim()
        ? entry.media_asset_id.trim()
        : null,
    original:
      original ||
      (enhanced && selectedVariant === "enhanced" ? { url: enhanced.url, path: null } : null),
    enhanced,
    variants:
      entry.variants && typeof entry.variants === "object" && !Array.isArray(entry.variants)
        ? entry.variants
        : null,
    selectedVariant,
  };
}

function getVariantUrl(variant, useCase) {
  if (!variant?.variants || typeof variant.variants !== "object") return null;
  if (useCase === "listing_thumb") {
    return (
      variant.variants.thumb_320 ||
      variant.variants.thumb ||
      variant.variants.thumbnail ||
      variant.variants.card_640 ||
      variant.variants.card ||
      variant.variants.detail_1200 ||
      variant.variants.detail ||
      null
    );
  }
  if (useCase === "listing_card") {
    return (
      variant.variants.card_640 ||
      variant.variants.card ||
      variant.variants.thumb_320 ||
      variant.variants.thumb ||
      variant.variants.thumbnail ||
      variant.variants.detail_1200 ||
      variant.variants.detail ||
      null
    );
  }
  if (useCase === "listing_detail") {
    return (
      variant.variants.detail_1200 ||
      variant.variants.detail ||
      variant.variants.card_640 ||
      variant.variants.card ||
      variant.variants.thumb_320 ||
      variant.variants.thumb ||
      variant.variants.thumbnail ||
      null
    );
  }
  return null;
}

export function getSelectedPhotoUrl(variant, useCase = null) {
  if (!variant || typeof variant !== "object") return null;
  if (variant.selectedVariant === "enhanced" && variant.enhanced?.url) {
    return variant.enhanced.url;
  }
  const variantUrl = getVariantUrl(variant, useCase);
  if (variantUrl) return variantUrl;
  return variant.original?.url || variant.enhanced?.url || null;
}

export function resolveListingCoverImage(listing) {
  if (!listing || typeof listing !== "object") return null;

  const variants = extractStoredPhotoVariants(
    listing.photo_url || listing.photos || null,
    listing.photo_variants || null
  );

  if (!variants.length) return null;

  const requestedCoverId =
    typeof listing.cover_image_id === "string" ? listing.cover_image_id.trim() : "";
  if (requestedCoverId) {
    const matchedVariant = variants.find((variant) => variant?.id === requestedCoverId);
    if (matchedVariant) return matchedVariant;
  }

  return variants[0] || null;
}

export function resolveListingCoverImageUrl(listing, useCase = "listing_card") {
  return getSelectedPhotoUrl(resolveListingCoverImage(listing), useCase) || null;
}

export function resolveListingCardImageUrl(listing, fallback = null) {
  return resolveListingCoverImageUrl(listing, "listing_card") || fallback || null;
}

export function resolveListingThumbImageUrl(listing, fallback = null) {
  return resolveListingCoverImageUrl(listing, "listing_thumb") || fallback || null;
}

export function resolveListingDetailImageUrl(listing, fallback = null) {
  return resolveListingCoverImageUrl(listing, "listing_detail") || fallback || null;
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
    .map((entry, index) => {
      const normalized = normalizeStoredVariantEntry(entry, photoUrls[index]);
      if (!normalized) return null;
      return {
        ...normalized,
        media_asset_id: normalized.media_asset_id || null,
        id:
          normalized.id ||
          normalized.media_asset_id ||
          entry?.original?.path ||
          entry?.original?.url ||
          entry?.enhanced?.path ||
          entry?.enhanced?.url ||
          `photo-${index + 1}`,
      };
    })
    .filter(Boolean);

  if (variants.length) {
    return variants;
  }

  return photoUrls
    .map((url, index) => {
      const normalized = normalizeStoredVariantEntry(null, url);
      if (!normalized) return null;
      return {
        ...normalized,
        media_asset_id: normalized.media_asset_id || null,
        id: normalized.id || url || `photo-${index + 1}`,
      };
    })
    .filter(Boolean);
}

export function serializeStoredPhotoVariants(variants) {
  if (!Array.isArray(variants)) return [];

  return variants
    .map((variant) => {
      const original = normalizeStoredAsset(variant?.original);
      const enhancedBase = normalizeStoredAsset(variant?.enhanced);
      const storedVariants =
        variant?.variants && typeof variant.variants === "object" && !Array.isArray(variant.variants)
          ? variant.variants
          : null;
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
        id:
          typeof variant?.id === "string" && variant.id.trim()
            ? variant.id.trim()
            : original?.path || original?.url || enhanced?.path || enhanced?.url || null,
        ...(typeof variant?.media_asset_id === "string" && variant.media_asset_id.trim()
          ? { media_asset_id: variant.media_asset_id.trim() }
          : {}),
        original:
          original ||
          (enhanced ? { url: enhanced.url, path: enhanced.path || null } : null),
        enhanced,
        ...(storedVariants ? { variants: storedVariants } : {}),
        selectedVariant:
          variant?.selectedVariant === "enhanced" && enhanced ? "enhanced" : "original",
      };
    })
    .filter(Boolean);
}
