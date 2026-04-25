import {
  extractStoredPhotoVariants,
  getSelectedPhotoUrl,
  serializeStoredPhotoVariants,
} from "@/lib/listingPhotos";

function buildDraftId(prefix = "photo") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const ENHANCEABLE_BACKGROUND_OPTIONS = [
  { value: "original", label: "Original" },
  { value: "white", label: "White" },
  { value: "soft_gray", label: "Soft gray" },
];

export function createLocalPhotoDraft(file, options = {}) {
  return {
    id: buildDraftId("draft"),
    status: "new",
    source: options?.source || "unknown",
    normalization: options?.normalization || null,
    original: {
      file,
      previewUrl: URL.createObjectURL(file),
      publicUrl: null,
      path: null,
      name: file.name || "photo.jpg",
      contentType: file.type || "image/jpeg",
    },
    enhanced: null,
    selectedVariant: "original",
    enhancement: {
      background: "white",
      isProcessing: false,
      error: "",
    },
  };
}

export function revokeLocalPhotoDraftUrls(drafts) {
  if (!Array.isArray(drafts)) return;
  drafts.forEach((draft) => {
    if (draft?.status === "new" && draft?.original?.previewUrl) {
      URL.revokeObjectURL(draft.original.previewUrl);
    }
  });
}

export function hydratePhotoDrafts(photoField, variantsField) {
  return extractStoredPhotoVariants(photoField, variantsField).map((variant) => ({
    id: variant.id || buildDraftId("existing"),
    status: "existing",
    original: {
      file: null,
      previewUrl: variant.original?.url || null,
      publicUrl: variant.original?.url || null,
      path: variant.original?.path || null,
      name: null,
      contentType: null,
    },
    enhanced: variant.enhanced
      ? {
          publicUrl: variant.enhanced.url,
          path: variant.enhanced.path || null,
          background: variant.enhanced.background || "white",
          lighting: variant.enhanced.lighting || "auto",
          shadow: variant.enhanced.shadow || "subtle",
        }
      : null,
    selectedVariant: variant.selectedVariant || "original",
    normalization: null,
    enhancement: {
      background: variant.enhanced?.background || "white",
      isProcessing: false,
      error: "",
    },
  }));
}

export function resolveCoverImageId(drafts, requestedCoverImageId = null) {
  const list = Array.isArray(drafts) ? drafts.filter(Boolean) : [];
  if (!list.length) return null;
  const requested = typeof requestedCoverImageId === "string" ? requestedCoverImageId.trim() : "";
  if (requested && list.some((draft) => draft?.id === requested)) {
    return requested;
  }
  return list[0]?.id || null;
}

export function getCoverPhotoDraft(drafts, coverImageId = null) {
  const list = Array.isArray(drafts) ? drafts.filter(Boolean) : [];
  if (!list.length) return null;
  const resolvedCoverId = resolveCoverImageId(list, coverImageId);
  return list.find((draft) => draft?.id === resolvedCoverId) || list[0] || null;
}

export function convertPhotoDraftsToSavedState(drafts) {
  return (drafts || []).map((draft) => {
    const originalUrl = draft?.original?.publicUrl || draft?.original?.previewUrl || null;
    if (draft?.status === "new" && draft?.original?.previewUrl) {
      URL.revokeObjectURL(draft.original.previewUrl);
    }

    return {
      ...draft,
      status: "existing",
      original: {
        file: null,
        previewUrl: originalUrl,
        publicUrl: originalUrl,
        path: draft?.original?.path || null,
        name: draft?.original?.name || null,
        contentType: draft?.original?.contentType || null,
      },
      enhancement: {
        background: draft?.enhanced?.background || draft?.enhancement?.background || "white",
        isProcessing: false,
        error: "",
      },
    };
  });
}

export function getDraftDisplayUrl(draft, variant = draft?.selectedVariant) {
  if (!draft) return null;
  if (variant === "enhanced" && draft.enhanced?.publicUrl) {
    return draft.enhanced.publicUrl;
  }
  return draft.original?.previewUrl || draft.original?.publicUrl || draft.enhanced?.publicUrl || null;
}

export function buildListingPhotoPayloadFromDrafts(drafts) {
  const orderedDrafts = Array.isArray(drafts) ? drafts.filter(Boolean) : [];
  const variants = serializeStoredPhotoVariants(
    orderedDrafts.map((draft) => ({
      id: draft?.id || null,
      original: {
        url: draft?.original?.publicUrl || draft?.original?.previewUrl || null,
        path: draft?.original?.path || null,
      },
      enhanced: draft?.enhanced
        ? {
            url: draft.enhanced.publicUrl,
            path: draft.enhanced.path || null,
            background: draft.enhanced.background || "white",
            lighting: draft.enhanced.lighting || "auto",
            shadow: draft.enhanced.shadow || "subtle",
          }
        : null,
      selectedVariant: draft?.selectedVariant || "original",
    }))
  );

  return {
    photoUrls: variants.map((variant) => getSelectedPhotoUrl(variant)).filter(Boolean),
    photoVariants: variants,
  };
}

export function orderPhotoDraftsWithCoverFirst(drafts, coverImageId = null) {
  const list = Array.isArray(drafts) ? [...drafts].filter(Boolean) : [];
  if (list.length <= 1) return list;
  const resolvedCoverId = resolveCoverImageId(list, coverImageId);
  const coverIndex = list.findIndex((draft) => draft?.id === resolvedCoverId);
  if (coverIndex <= 0) return list;
  const [coverDraft] = list.splice(coverIndex, 1);
  return [coverDraft, ...list];
}
