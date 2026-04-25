import { stripHtmlToText } from "@/lib/listingDescription";
import { validateListingOptions } from "@/lib/listingOptions";

export const LISTING_DRAFT_TITLE = "Untitled draft";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePublishPrice(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Number(parsed.toFixed(2));
  return rounded > 0 ? rounded : null;
}

function serializePhotosForSave(photos) {
  return (photos || []).map((photo) => ({
    id: photo?.id || null,
    status: photo?.status || null,
    selectedVariant: photo?.selectedVariant || "original",
    original: {
      name: photo?.original?.name || photo?.original?.file?.name || null,
      path: photo?.original?.path || null,
      publicUrl: photo?.original?.publicUrl || null,
      previewUrl: photo?.original?.previewUrl || null,
      fileSize:
        typeof photo?.original?.file?.size === "number" ? photo.original.file.size : null,
      lastModified:
        typeof photo?.original?.file?.lastModified === "number"
          ? photo.original.file.lastModified
          : null,
    },
    enhanced: photo?.enhanced
      ? {
          publicUrl: photo.enhanced.publicUrl || null,
          path: photo.enhanced.path || null,
          background: photo.enhanced.background || "white",
        }
      : null,
  }));
}

export function buildListingSaveSignature({ form, photos, listingOptions, coverImageId }) {
  return JSON.stringify({
    form: {
      title: form?.title || "",
      description: form?.description || "",
      price: form?.price || "",
      category: form?.category || "",
      inventoryQuantity: form?.inventoryQuantity ?? "",
      inventoryStatus: form?.inventoryStatus || "in_stock",
      lowStockThreshold: form?.lowStockThreshold ?? "",
      pickupEnabled: form?.pickupEnabled !== false,
      localDeliveryEnabled: form?.localDeliveryEnabled === true,
      useBusinessDeliveryDefaults: form?.useBusinessDeliveryDefaults !== false,
      deliveryFee: form?.deliveryFee || "",
      city: form?.city || "",
    },
    coverImageId: coverImageId || null,
    photos: serializePhotosForSave(photos),
    listingOptions: listingOptions || null,
  });
}

export function formatListingPriceInput(value) {
  const normalizedPrice = normalizePublishPrice(value);
  return normalizedPrice === null ? "" : String(normalizedPrice);
}

export function hasMeaningfulDraftContent({ form, photos, listingOptions }) {
  if ((photos || []).length > 0) return true;
  if (normalizeText(form?.title)) return true;
  if (normalizeText(stripHtmlToText(form?.description || ""))) return true;
  if (normalizeText(form?.price)) return true;
  if (normalizeText(form?.category)) return true;
  if (normalizeText(String(form?.inventoryQuantity ?? ""))) return true;
  if (normalizeText(String(form?.lowStockThreshold ?? ""))) return true;
  if (normalizeText(form?.deliveryFee)) return true;
  if (listingOptions?.hasOptions) return true;
  return false;
}

export function getListingDraftTitle(title) {
  return normalizeText(title) || LISTING_DRAFT_TITLE;
}

export function buildListingPublicationState(targetStatus) {
  const normalizedStatus =
    String(targetStatus || "").trim().toLowerCase() === "published"
      ? "published"
      : "draft";

  return {
    status: normalizedStatus,
  };
}

function trySerializeError(error) {
  if (!error || typeof error !== "object") return null;
  try {
    return JSON.stringify(error);
  } catch {
    return null;
  }
}

export function getListingSaveErrorMessage(error, fallbackMessage) {
  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  const serialized = trySerializeError(error);
  if (serialized && serialized !== "{}") {
    return serialized;
  }

  return fallbackMessage;
}

function formatInlineList(items) {
  if (!items.length) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

const PUBLISH_REQUIREMENT_LABELS = {
  title: "a title",
  price: "a price",
  category: "a category",
  photos: "a photo",
  description: "a description",
  deliveryFee: "a delivery fee",
  options: "product options",
};

export function getListingPublishDisabledReason(validation) {
  if (!validation || validation.ok) return "";

  const fieldErrors = validation.fieldErrors || {};
  const missingKeys = [
    "title",
    "price",
    "category",
    "photos",
    "description",
    "deliveryFee",
    "options",
  ].filter((key) => fieldErrors[key]);

  if (!missingKeys.length) {
    return "Complete the required fields before publishing.";
  }

  if (missingKeys.length === 1 && missingKeys[0] === "options") {
    return "Finish product options before publishing.";
  }

  const labels = missingKeys
    .slice(0, 4)
    .map((key) => PUBLISH_REQUIREMENT_LABELS[key])
    .filter(Boolean);

  if (!labels.length) {
    return "Complete the required fields before publishing.";
  }

  return `Add ${formatInlineList(labels)} to publish.`;
}

export function validateListingForPublish({
  form,
  photos,
  businessFulfillmentDefaults,
  listingOptions,
  dollarsInputToCents,
}) {
  const fieldErrors = {};

  if (!normalizeText(form?.title)) {
    fieldErrors.title = "Add a listing title.";
  }

  if (!(photos || []).length) {
    fieldErrors.photos = "Add at least one photo.";
  }

  if (!normalizeText(form?.category)) {
    fieldErrors.category = "Select a category.";
  }

  if (!normalizeText(stripHtmlToText(form?.description || ""))) {
    fieldErrors.description = "Add a description.";
  }

  const publishPrice = normalizePublishPrice(form?.price);
  if (publishPrice === null) {
    fieldErrors.price = "Add a price.";
  }

  if (
    form?.localDeliveryEnabled &&
    form?.useBusinessDeliveryDefaults &&
    businessFulfillmentDefaults?.default_delivery_fee_cents == null
  ) {
    fieldErrors.deliveryFee =
      "Add a default delivery fee in business settings before enabling delivery.";
  }

  const listingDeliveryFeeCents = dollarsInputToCents(form?.deliveryFee);
  if (
    form?.localDeliveryEnabled &&
    !form?.useBusinessDeliveryDefaults &&
    (Number.isNaN(listingDeliveryFeeCents) || listingDeliveryFeeCents === null)
  ) {
    fieldErrors.deliveryFee = "Enter a valid listing delivery fee.";
  }

  const listingOptionsValidation = validateListingOptions(listingOptions);
  if (!listingOptionsValidation.ok) {
    fieldErrors.options =
      listingOptionsValidation.errors?.form?.[0] || "Finish the product options section.";
  }

  const orderedFields = ["title", "photos", "category", "description", "price", "deliveryFee", "options"];
  const formError =
    orderedFields.map((key) => fieldErrors[key]).find(Boolean) || null;

  return {
    ok: !formError,
    fieldErrors,
    formError,
    publishPrice,
    listingDeliveryFeeCents,
    listingOptionsValidation,
  };
}
