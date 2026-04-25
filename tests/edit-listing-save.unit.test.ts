import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatListingPriceInput,
  getListingPublishDisabledReason,
  validateListingForPublish,
} from "@/lib/listingEditor";

const editListingSource = readFileSync(
  path.join(process.cwd(), "app/(business)/business/listings/[id]/edit/page.js"),
  "utf8"
);

function buildPublishValidation(price) {
  return validateListingForPublish({
    form: {
      title: "Cold brew",
      description: "Small batch concentrate.",
      price,
      category: "clothing-fashion",
      inventoryQuantity: "",
      inventoryStatus: "in_stock",
      lowStockThreshold: "",
      pickupEnabled: true,
      localDeliveryEnabled: false,
      useBusinessDeliveryDefaults: true,
      deliveryFee: "",
      city: "Austin",
    },
    photos: [{ id: "photo-1" }],
    businessFulfillmentDefaults: {
      pickup_enabled_default: true,
      local_delivery_enabled_default: false,
      default_delivery_fee_cents: null,
    },
    listingOptions: {
      hasOptions: false,
      attributes: [],
      variants: [],
    },
    dollarsInputToCents: (value) => {
      if (value === "" || value == null) return null;
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return Number.NaN;
      return Math.round(parsed * 100);
    },
  });
}

describe("Edit listing save flow", () => {
  it("renders inline save errors instead of relying on browser alerts", () => {
    expect(editListingSource).toContain('const [submitError, setSubmitError] = useState("");');
    expect(editListingSource).toContain('role="alert"');
    expect(editListingSource).toContain('setSubmitError(');
    expect(editListingSource).toContain("getListingSaveErrorMessage");
    expect(editListingSource).toContain('data-testid="listing-editor-action-status"');
    expect(editListingSource).not.toContain("alert(");
  });

  it("keeps the edit save pipeline wired through draft and publish mutations", () => {
    expect(editListingSource).toContain("<form onSubmit={handleSubmit}");
    expect(editListingSource).toContain("buildListingPublicationState(targetStatus)");
    expect(editListingSource).toContain('.from("listings")');
    expect(editListingSource).toContain(".update(payload)");
    expect(editListingSource).toContain("cover_image_id: resolvedCoverImageId");
    expect(editListingSource).toContain('.eq("id", internalListingId)');
    expect(editListingSource).toContain("await saveListingVariants(");
    expect(editListingSource).toContain("handleSaveDraft()");
    expect(editListingSource).toContain('await persistListing("draft")');
    expect(editListingSource).toContain('await persistListing("published")');
    expect(editListingSource).toContain("Save draft");
    expect(editListingSource).toContain("Publish listing");
    expect(editListingSource).toContain('router.push("/business/listings")');
  });

  it("keeps published edits published unless the explicit draft action is used", () => {
    expect(editListingSource).toContain('const publicationState = buildListingPublicationState(targetStatus);');
    expect(editListingSource).toContain('...publicationState,');
    expect(editListingSource).toContain('setListingStatus(targetStatus);');
    expect(editListingSource).not.toContain("is_published:");
    expect(editListingSource).toContain("getListingPublishDisabledReason(publishValidation)");
    expect(editListingSource).toContain("publishDisabledReason");
    expect(editListingSource).toContain("formatListingPriceInput(data.price)");
    expect(editListingSource).toContain("resolveCoverImageId(hydratedPhotos, data.cover_image_id)");
  });

  it("treats hydrated numeric edit prices as publishable without touching the field", () => {
    const validation = buildPublishValidation(12);

    expect(formatListingPriceInput(12)).toBe("12");
    expect(validation.ok).toBe(true);
    expect(validation.fieldErrors.price).toBeUndefined();
    expect(getListingPublishDisabledReason(validation)).not.toContain("price");
  });

  it("disables publish when price is cleared and re-enables when a valid price is re-entered", () => {
    const clearedValidation = buildPublishValidation("");
    expect(clearedValidation.ok).toBe(false);
    expect(clearedValidation.fieldErrors.price).toBe("Add a price.");
    expect(getListingPublishDisabledReason(clearedValidation)).toContain("price");

    const restoredValidation = buildPublishValidation("14.50");
    expect(restoredValidation.ok).toBe(true);
    expect(restoredValidation.fieldErrors.price).toBeUndefined();
    expect(getListingPublishDisabledReason(restoredValidation)).toBe("");
  });
});
