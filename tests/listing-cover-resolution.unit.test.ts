import { describe, expect, it } from "vitest";
import {
  getSelectedPhotoUrl,
  resolveListingCoverImage,
  resolveListingCoverImageUrl,
} from "@/lib/listingPhotos";

describe("listing cover resolution", () => {
  it("returns the explicitly selected cover image when cover_image_id matches", () => {
    const listing = {
      cover_image_id: "photo-2",
      photo_variants: [
        {
          id: "photo-1",
          original: { url: "https://example.com/photo-1.jpg", path: "listing-photos/photo-1.jpg" },
          enhanced: null,
          selectedVariant: "original",
        },
        {
          id: "photo-2",
          original: { url: "https://example.com/photo-2.jpg", path: "listing-photos/photo-2.jpg" },
          enhanced: null,
          selectedVariant: "original",
        },
      ],
      photo_url: JSON.stringify([
        "https://example.com/photo-1.jpg",
        "https://example.com/photo-2.jpg",
      ]),
    };

    const cover = resolveListingCoverImage(listing);
    expect(cover?.id).toBe("photo-2");
    expect(getSelectedPhotoUrl(cover)).toBe("https://example.com/photo-2.jpg");
    expect(resolveListingCoverImageUrl(listing)).toBe("https://example.com/photo-2.jpg");
  });

  it("falls back to the first image when cover_image_id is missing", () => {
    const listing = {
      photo_variants: [
        {
          id: "photo-1",
          original: { url: "https://example.com/photo-1.jpg", path: "listing-photos/photo-1.jpg" },
          enhanced: null,
          selectedVariant: "original",
        },
        {
          id: "photo-2",
          original: { url: "https://example.com/photo-2.jpg", path: "listing-photos/photo-2.jpg" },
          enhanced: null,
          selectedVariant: "original",
        },
      ],
      photo_url: JSON.stringify([
        "https://example.com/photo-1.jpg",
        "https://example.com/photo-2.jpg",
      ]),
    };

    expect(resolveListingCoverImage(listing)?.id).toBe("photo-1");
    expect(resolveListingCoverImageUrl(listing)).toBe("https://example.com/photo-1.jpg");
  });
});
