import { describe, expect, it } from "vitest";
import {
  getBusinessAvatarImage,
  getBusinessCoverImage,
  getBusinessInitials,
  getOnboardingDemoBusinessImage,
  isKnownBusinessPlaceholderImage,
  resolveBusinessAvatarUrl,
  resolveBusinessCoverUrl,
} from "@/lib/businessImages";

describe("business image resolvers", () => {
  it("keeps onboarding demo storefront assets isolated behind the demo helper", () => {
    expect(getOnboardingDemoBusinessImage("tech shop")).toBe(
      "/placeholders/business/types/tech-shop.png"
    );
    expect(getOnboardingDemoBusinessImage("unknown category")).toBe(
      "/placeholders/business/types/boutique.png"
    );
  });

  it("treats known demo and legacy placeholder media as non-real", () => {
    expect(isKnownBusinessPlaceholderImage("/placeholders/business/types/boutique.png")).toBe(true);
    expect(
      isKnownBusinessPlaceholderImage(
        "https://cdn.example.com/placeholders/business/types/bookstore.png?width=800"
      )
    ).toBe(true);
    expect(isKnownBusinessPlaceholderImage("/business-placeholder.png")).toBe(true);
    expect(isKnownBusinessPlaceholderImage("https://cdn.example.com/uploads/logo.png")).toBe(false);
  });

  it("uses real avatar identity fields and never falls back to cover", () => {
    expect(
      getBusinessAvatarImage({
        business_name: "Paper Harbor",
        cover_photo_url: "https://cdn.example.com/cover.jpg",
      })
    ).toMatchObject({
      kind: "placeholder",
      initials: "PH",
    });

    expect(
      getBusinessAvatarImage({
        business_name: "Paper Harbor",
        logo_url: "https://cdn.example.com/logo.png",
        profile_photo_url: "/placeholders/business/types/bookstore.png",
      })
    ).toEqual({
      kind: "image",
      src: "https://cdn.example.com/logo.png",
    });
  });

  it("keeps media asset avatar and cover resolution separate", () => {
    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    try {
      const business = {
        business_name: "Media Asset Shop",
        bucket: "business-photos",
        profile_photo_url: "https://cdn.example.com/legacy-avatar.jpg",
        cover_photo_url: "https://cdn.example.com/legacy-cover.jpg",
        media_assets: [
          {
            purpose: "business_cover",
            bucket: "business-photos",
            cover_desktop_path: "owner/cover/asset/cover_desktop_1600.webp",
            public_url: "https://cdn.example.com/cover-public-url.webp",
          },
          {
            purpose: "business_avatar",
            bucket: "business-photos",
            avatar_256_path: "owner/avatar/asset/avatar_256.webp",
            avatar_128_path: "owner/avatar/asset/avatar_128.webp",
          },
        ],
      };

      expect(resolveBusinessAvatarUrl(business)).toBe(
        "https://example.supabase.co/storage/v1/object/public/business-photos/owner/avatar/asset/avatar_256.webp"
      );
      expect(resolveBusinessCoverUrl(business)).toBe(
        "https://example.supabase.co/storage/v1/object/public/business-photos/owner/cover/asset/cover_desktop_1600.webp"
      );
      expect(resolveBusinessAvatarUrl({ ...business, media_assets: [business.media_assets[0]] })).toBe(
        "https://cdn.example.com/legacy-avatar.jpg"
      );
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    }
  });

  it("prefers an explicitly linked business avatar media asset over legacy avatar fields", () => {
    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    try {
      expect(
        resolveBusinessAvatarUrl({
          avatar_media_asset_id: "avatar-asset-1",
          business_avatar_media_asset: {
            id: "avatar-asset-1",
            purpose: "business_avatar",
            bucket: "business-photos",
            avatar_128_path: "owner/avatar/asset/avatar_128.webp",
            avatar_256_path: "owner/avatar/asset/avatar_256.webp",
            avatar_512_path: "owner/avatar/asset/avatar_512.webp",
            public_url: "https://cdn.example.com/avatar-public-url.webp",
          },
          avatar_url: "https://cdn.example.com/avatar-url.jpg",
          logo_url: "https://cdn.example.com/logo.png",
          profile_photo_url: "https://cdn.example.com/legacy-avatar.jpg",
        })
      ).toBe(
        "https://example.supabase.co/storage/v1/object/public/business-photos/owner/avatar/asset/avatar_512.webp"
      );
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    }
  });

  it("falls back through avatar media variants before legacy URLs", () => {
    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    try {
      expect(
        resolveBusinessAvatarUrl({
          avatar_media_asset_id: "avatar-asset-1",
          business_avatar_media_asset: {
            id: "avatar-asset-1",
            purpose: "business_avatar",
            bucket: "business-photos",
            avatar_256_path: "owner/avatar/asset/avatar_256.webp",
            avatar_128_path: "owner/avatar/asset/avatar_128.webp",
          },
          profile_photo_url: "https://cdn.example.com/profile.jpg",
        })
      ).toBe(
        "https://example.supabase.co/storage/v1/object/public/business-photos/owner/avatar/asset/avatar_256.webp"
      );

      expect(
        resolveBusinessAvatarUrl({
          avatar_media_asset_id: "avatar-asset-1",
          business_avatar_media_asset: {
            id: "avatar-asset-1",
            purpose: "business_avatar",
            bucket: "business-photos",
            avatar_128_path: "owner/avatar/asset/avatar_128.webp",
          },
          logo_url: "https://cdn.example.com/logo.png",
        })
      ).toBe(
        "https://example.supabase.co/storage/v1/object/public/business-photos/owner/avatar/asset/avatar_128.webp"
      );
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    }
  });

  it("does not use user avatar media assets for business avatar resolution", () => {
    expect(
      resolveBusinessAvatarUrl({
        profile_photo_url: "https://cdn.example.com/business-profile.jpg",
        media_assets: [
          {
            purpose: "user_avatar",
            bucket: "business-photos",
            avatar_256_path: "owner/avatar/user-avatar/avatar_256.webp",
          },
        ],
      })
    ).toBe("https://cdn.example.com/business-profile.jpg");
  });

  it("preserves legacy avatar fallbacks and placeholder behavior", () => {
    expect(
      getBusinessAvatarImage({
        business_name: "Logo Shop",
        logo_url: "https://cdn.example.com/logo.png",
      })
    ).toEqual({ kind: "image", src: "https://cdn.example.com/logo.png" });

    expect(
      getBusinessAvatarImage({
        business_name: "Legacy Photo Shop",
        profile_photo_url: "https://cdn.example.com/profile.jpg",
      })
    ).toEqual({ kind: "image", src: "https://cdn.example.com/profile.jpg" });

    expect(getBusinessAvatarImage({ business_name: "Paper Harbor" })).toMatchObject({
      kind: "placeholder",
      initials: "PH",
    });
  });

  it("prefers a directly linked business cover media asset over the legacy cover URL", () => {
    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    try {
      expect(
        resolveBusinessCoverUrl({
          cover_photo_url: "https://cdn.example.com/legacy-cover.jpg",
          cover_media_asset_id: "cover-asset-1",
          business_cover_media_asset: {
            purpose: "business_cover",
            bucket: "business-photos",
            cover_mobile_path: "owner/cover/asset/cover_mobile_900.webp",
            cover_desktop_path: "owner/cover/asset/cover_desktop_1600.webp",
          },
        })
      ).toBe(
        "https://example.supabase.co/storage/v1/object/public/business-photos/owner/cover/asset/cover_desktop_1600.webp"
      );
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    }
  });

  it("returns only real uploaded covers", () => {
    expect(
      getBusinessCoverImage({
        cover_photo_url: "/placeholders/business/types/florist-plants.png",
      })
    ).toBeNull();
    expect(getBusinessCoverImage({ cover_photo_url: "https://cdn.example.com/cover.jpg" })).toBe(
      "https://cdn.example.com/cover.jpg"
    );
  });

  it("normalizes legacy Supabase bucket paths to public storage URLs when possible", () => {
    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    try {
      expect(
        getBusinessAvatarImage({
          business_name: "Legacy Photo Shop",
          profile_photo_url: "business-photos/avatar-123.jpg",
        })
      ).toEqual({
        kind: "image",
        src: "https://example.supabase.co/storage/v1/object/public/business-photos/avatar-123.jpg",
      });
      expect(
        getBusinessCoverImage({
          cover_photo_url: "business-photos/cover-123.jpg",
        })
      ).toBe(
        "https://example.supabase.co/storage/v1/object/public/business-photos/cover-123.jpg"
      );
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    }
  });

  it("keeps legacy bucket paths routable when the Supabase URL is unavailable", () => {
    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    try {
      expect(
        getBusinessCoverImage({
          cover_photo_url: "business-photos/cover-123.jpg",
        })
      ).toBe("/business-photos/cover-123.jpg");
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    }
  });

  it("builds stable business initials", () => {
    expect(getBusinessInitials({ business_name: "Paper Harbor" })).toBe("PH");
    expect(getBusinessInitials({ business_name: "  123 Tech  " })).toBe("1T");
    expect(getBusinessInitials({ business_name: "" })).toBe("LB");
  });
});
