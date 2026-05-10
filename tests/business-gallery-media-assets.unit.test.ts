import { describe, expect, it } from "vitest";
import {
  BUSINESS_GALLERY_LEGACY_SELECT,
  BUSINESS_GALLERY_WITH_MEDIA_SELECT,
  isBusinessGalleryMediaSelectError,
  resolveBusinessGalleryImageUrl,
} from "@/lib/businessGalleryPhotos";
import { sanitizeGalleryPhotos } from "@/lib/publicBusinessProfile/normalize";

describe("business gallery media asset resolution", () => {
  it("prefers optimized gallery card variants over legacy photo_url", () => {
    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    try {
      const photo = {
        photo_url: "https://legacy.example.com/original.jpg",
        media_asset: {
          bucket: "business-photos",
          card_path: "owner/gallery/asset/card_640.webp",
          thumb_path: "owner/gallery/asset/thumb_320.webp",
          detail_path: "owner/gallery/asset/detail_1200.webp",
        },
      };

      expect(resolveBusinessGalleryImageUrl(photo, { useCase: "card" })).toBe(
        "https://example.supabase.co/storage/v1/object/public/business-photos/owner/gallery/asset/card_640.webp"
      );
      expect(resolveBusinessGalleryImageUrl(photo, { useCase: "detail" })).toBe(
        "https://example.supabase.co/storage/v1/object/public/business-photos/owner/gallery/asset/detail_1200.webp"
      );
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    }
  });

  it("keeps legacy gallery images rendering without media assets", () => {
    expect(
      resolveBusinessGalleryImageUrl({
        photo_url: "https://legacy.example.com/gallery.jpg",
      })
    ).toBe("https://legacy.example.com/gallery.jpg");
  });

  it("preserves linked media asset data during public profile normalization", () => {
    const sanitized = sanitizeGalleryPhotos([
      {
        id: "photo-1",
        photo_url: "https://legacy.example.com/gallery.jpg",
        media_asset_id: "asset-1",
        media_asset: {
          bucket: "business-photos",
          card_path: "owner/gallery/asset/card_640.webp",
        },
      },
    ]);

    expect(sanitized[0]).toMatchObject({
      id: "photo-1",
      media_asset_id: "asset-1",
      media_asset: {
        card_path: "owner/gallery/asset/card_640.webp",
      },
    });
  });

  it("defines a media-aware read select with legacy fallback detection", () => {
    expect(BUSINESS_GALLERY_WITH_MEDIA_SELECT).toContain("media_asset_id");
    expect(BUSINESS_GALLERY_WITH_MEDIA_SELECT).toContain("media_asset:media_assets");
    expect(BUSINESS_GALLERY_LEGACY_SELECT).not.toContain("media_asset_id");
    expect(isBusinessGalleryMediaSelectError({ code: "42703", message: "column does not exist" })).toBe(true);
    expect(isBusinessGalleryMediaSelectError({ code: "PGRST200", message: "relationship not found" })).toBe(true);
  });
});
