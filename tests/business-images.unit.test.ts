import { describe, expect, it } from "vitest";
import {
  getBusinessAvatarImage,
  getBusinessCoverImage,
  getBusinessInitials,
  getOnboardingDemoBusinessImage,
  isKnownBusinessPlaceholderImage,
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

  it("builds stable business initials", () => {
    expect(getBusinessInitials({ business_name: "Paper Harbor" })).toBe("PH");
    expect(getBusinessInitials({ business_name: "  123 Tech  " })).toBe("1T");
    expect(getBusinessInitials({ business_name: "" })).toBe("LB");
  });
});
