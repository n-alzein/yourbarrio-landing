import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const { notFoundMock, permanentRedirectMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  permanentRedirectMock: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: any) => fn,
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  permanentRedirect: permanentRedirectMock,
}));

vi.mock("@/lib/business/getPublicBusinessByPublicId", () => ({
  getPublicBusinessByPublicId: vi.fn(async (publicId: string) => {
    if (publicId !== "eaca122466") return null;
    return {
      id: "11111111-1111-4111-8111-111111111111",
      owner_user_id: "11111111-1111-4111-8111-111111111111",
      business_row_id: "biz-row-1",
      public_id: "eaca122466",
      business_name: "Test Store 2",
      business_type: "Retail",
      full_name: null,
      category: "Retail",
      description: "Public business with no coordinates and no listings.",
      website: null,
      phone: null,
      profile_photo_url: null,
      cover_photo_url: null,
      address: null,
      address_2: null,
      city: "Los Angeles",
      state: "CA",
      postal_code: "90001",
      pickup_enabled_default: true,
      local_delivery_enabled_default: false,
      default_delivery_fee_cents: null,
      delivery_radius_miles: null,
      delivery_min_order_cents: null,
      delivery_notes: null,
      latitude: null,
      longitude: null,
      hours_json: {},
      social_links_json: {},
      is_internal: false,
      verification_status: "manually_verified",
      account_status: "active",
      deleted_at: null,
    };
  }),
}));

vi.mock("@/lib/business/getPublicBusinessByOwnerId", () => ({
  getPublicBusinessByOwnerId: vi.fn(async () => null),
}));

function createQuery(data: any) {
  return {
    eq() {
      return this;
    },
    order() {
      return this;
    },
    limit() {
      return this;
    },
    or() {
      return this;
    },
    then(resolve: any) {
      return Promise.resolve(resolve({ data, error: null }));
    },
  };
}

vi.mock("@/lib/supabasePublicServer", () => ({
  getPublicSupabaseServerClient: () => ({
    from: vi.fn((table: string) => ({
      select: vi.fn(() => {
        if (table === "business_reviews") return createQuery([]);
        if (table === "public_listings_v") return createQuery([]);
        if (table === "business_announcements") return createQuery([]);
        if (table === "business_gallery_photos") return createQuery([]);
        if (table === "businesses") return createQuery(null);
        return createQuery([]);
      }),
    })),
  }),
}));

vi.mock("@/lib/supabaseServer", () => ({
  getSupabaseServerClient: vi.fn(async () => null),
}));

vi.mock("@/lib/publicVisibility", () => ({
  getCurrentViewerVisibilityGate: vi.fn(async () => ({
    viewerCanSeeInternalContent: false,
  })),
}));

vi.mock("@/components/publicBusinessProfile/BusinessProfileView", () => ({
  __esModule: true,
  default: ({ profile, listings }: any) => (
    <div data-testid="profile-view">
      <span>{profile.business_name}</span>
      <span>listings:{listings.length}</span>
    </div>
  ),
}));

vi.mock("@/components/publicBusinessProfile/PublicBusinessPreviewClient", () => ({
  __esModule: true,
  default: () => <div>preview</div>,
}));

vi.mock("@/components/publicBusinessProfile/ProfileViewTracker", () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock("@/lib/publicBusinessProfile/normalize", () => ({
  sanitizeAnnouncements: (value: any) => value || [],
  sanitizeGalleryPhotos: (value: any) => value || [],
  sanitizeListings: (value: any) => value || [],
  sanitizePublicProfile: (value: any) => value,
  sanitizeReviews: (value: any) => value || [],
}));

vi.mock("@/lib/publicBusinessProfile/reviews", () => ({
  fetchBusinessReviews: vi.fn(async () => []),
}));

vi.mock("@/lib/pricing", () => ({
  withListingPricing: (value: any) => value,
}));

import PublicBusinessProfilePage from "@/app/(public)/(marketing)/b/[id]/page";

const publicBusinessProfileSource = readFileSync(
  path.join(process.cwd(), "app/(public)/(marketing)/b/[id]/page.jsx"),
  "utf8"
);

describe("PublicBusinessProfilePage", () => {
  it("opens by public_id without requiring coordinates or listings", async () => {
    const result = await PublicBusinessProfilePage({
      params: Promise.resolve({ id: "eaca122466" }),
      searchParams: Promise.resolve({}),
    });

    expect(result).toBeTruthy();
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(permanentRedirectMock).not.toHaveBeenCalled();
  });

  it("reads public business listings from public_listings_v instead of base listings", () => {
    expect(publicBusinessProfileSource).toContain('.from("public_listings_v")');
    expect(publicBusinessProfileSource).not.toContain('.from("listings")');
  });
});
