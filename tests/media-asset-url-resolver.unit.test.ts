import { describe, expect, it, vi } from "vitest";
import {
  buildSupabasePublicUrl,
  resolveMediaAssetUrl,
  resolveVariantPath,
} from "@/lib/images/resolveMediaAssetUrl";

describe("media asset URL resolver", () => {
  it("selects use-case variants and falls back safely", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    const asset = {
      bucket: "business-photos",
      source_path: "business/source.webp",
      card_path: "business/card_640.webp",
      detail_path: "business/detail_1200.webp",
    };

    expect(resolveMediaAssetUrl(asset, "listing_card")).toBe(
      "https://example.supabase.co/storage/v1/object/public/business-photos/business/card_640.webp"
    );
    expect(resolveMediaAssetUrl(asset, "listing_detail")).toBe(
      "https://example.supabase.co/storage/v1/object/public/business-photos/business/detail_1200.webp"
    );
    expect(resolveMediaAssetUrl(asset, "avatar_small", "/fallback.png")).toBe(
      "https://example.supabase.co/storage/v1/object/public/business-photos/business/source.webp"
    );
    expect(resolveVariantPath(asset, "listing_card")).toBe("business/card_640.webp");
    vi.unstubAllEnvs();
  });

  it("preserves absolute URLs and local fallback paths", () => {
    expect(buildSupabasePublicUrl("business-photos", "https://cdn.example/image.webp")).toBe(
      "https://cdn.example/image.webp"
    );
    expect(resolveMediaAssetUrl(null, "listing_card", "/placeholder.png")).toBe(
      "/placeholder.png"
    );
  });
});
