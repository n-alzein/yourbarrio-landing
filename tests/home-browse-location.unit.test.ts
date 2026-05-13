import { describe, expect, it, vi, beforeEach } from "vitest";

const findBusinessOwnerIdsForLocationMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/supabasePublicServer", () => ({
  getPublicSupabaseServerClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/location/businessLocationSearch", () => ({
  findBusinessOwnerIdsForLocation: findBusinessOwnerIdsForLocationMock,
}));

vi.mock("@/lib/homepage/categories", () => ({
  getHomepageCategories: () => [],
}));

vi.mock("@/lib/pricing", () => ({
  withListingPricing: (listing: unknown) => listing,
}));

import { getHomeBrowseData } from "@/lib/browse/getHomeBrowseData";

describe("getHomeBrowseData location filtering", () => {
  beforeEach(() => {
    findBusinessOwnerIdsForLocationMock.mockReset();
    fromMock.mockReset();
  });

  it("does not fall back to unscoped listings when a valid selected location has zero matches", async () => {
    findBusinessOwnerIdsForLocationMock.mockResolvedValue([]);

    const result = await getHomeBrowseData({
      mode: "public",
      location: {
        city: "Costa Mesa",
        region: "CA",
        lat: 33.6411,
        lng: -117.9187,
      },
    });

    expect(result.city).toBe("Costa Mesa");
    expect(result.listings).toEqual([]);
    expect(fromMock).not.toHaveBeenCalledWith("public_listings_v");
    expect(fromMock).not.toHaveBeenCalledWith("public_listings");
  });
});
