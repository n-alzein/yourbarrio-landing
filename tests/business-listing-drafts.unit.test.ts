import { beforeEach, describe, expect, it, vi } from "vitest";

const { getBusinessDataClientForRequestMock, getListingVariantsMock } = vi.hoisted(() => ({
  getBusinessDataClientForRequestMock: vi.fn(),
  getListingVariantsMock: vi.fn(async () => ({ hasOptions: false, attributes: [], variants: [] })),
}));

vi.mock("@/lib/business/getBusinessDataClientForRequest", () => ({
  getBusinessDataClientForRequest: getBusinessDataClientForRequestMock,
}));

vi.mock("@/lib/listingOptions", () => ({
  getListingVariants: getListingVariantsMock,
}));

import { GET } from "@/app/api/business/listings/route";

function createListingsClient(listings: Record<string, unknown>[]) {
  return {
    from: vi.fn((table: string) => {
      if (table !== "listings") {
        throw new Error(`Unexpected table: ${table}`);
      }

      let rows = [...listings];
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn((field: string, value: unknown) => {
          rows = rows.filter((row) => row[field] === value);
          return query;
        }),
        is: vi.fn((field: string, value: unknown) => {
          rows = rows.filter((row) => row[field] === value);
          return query;
        }),
        order: vi.fn(async () => ({
          data: rows,
          error: null,
        })),
        maybeSingle: vi.fn(async () => ({
          data: rows[0] || null,
          error: null,
        })),
      };

      return query;
    }),
  };
}

describe("business listing drafts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns draft listings to the owning business", async () => {
    getBusinessDataClientForRequestMock.mockResolvedValue({
      ok: true,
      client: createListingsClient([
        {
          id: "listing-1",
          business_id: "business-1",
          title: "Draft listing",
          status: "draft",
          is_published: false,
          admin_hidden: false,
          deleted_at: null,
        },
      ]),
      effectiveUserId: "business-1",
    });

    const response = await GET(
      new Request("http://localhost:3000/api/business/listings")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.listings).toHaveLength(1);
    expect(payload.listings[0]).toMatchObject({
      id: "listing-1",
      status: "draft",
      is_published: false,
    });
  });

  it("excludes archived, deleted, and admin-hidden listings from seller list reads", async () => {
    getBusinessDataClientForRequestMock.mockResolvedValue({
      ok: true,
      client: createListingsClient([
        {
          id: "published-visible",
          business_id: "business-1",
          title: "Published visible",
          status: "published",
          admin_hidden: false,
          deleted_at: null,
        },
        {
          id: "draft-visible",
          business_id: "business-1",
          title: "Draft visible",
          status: "draft",
          admin_hidden: false,
          deleted_at: null,
        },
        {
          id: "admin-hidden",
          business_id: "business-1",
          title: "Admin hidden",
          status: "published",
          admin_hidden: true,
          deleted_at: null,
        },
        {
          id: "seller-deleted",
          business_id: "business-1",
          title: "Seller deleted",
          status: "published",
          admin_hidden: false,
          seller_deleted: true,
          deleted_at: null,
        },
        {
          id: "soft-deleted",
          business_id: "business-1",
          title: "Soft deleted",
          status: "published",
          admin_hidden: false,
          deleted_at: "2026-05-01T12:00:00.000Z",
        },
        {
          id: "archived",
          business_id: "business-1",
          title: "Archived",
          status: "archived",
          admin_hidden: false,
          deleted_at: null,
        },
      ]),
      effectiveUserId: "business-1",
    });

    const response = await GET(new Request("http://localhost:3000/api/business/listings"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.listings.map((listing: { id: string }) => listing.id)).toEqual([
      "published-visible",
      "draft-visible",
    ]);
  });

  it("overlays saved unpublished changes for published listings in edit reads", async () => {
    getBusinessDataClientForRequestMock.mockResolvedValue({
      ok: true,
      client: createListingsClient([
        {
          id: "listing-2",
          public_id: "listing-2",
          business_id: "business-1",
          title: "Live listing",
          status: "published",
          has_unpublished_changes: true,
          draft_data: {
            title: "Draft title",
            cover_image_id: "photo-2",
            listingOptions: {
              hasOptions: false,
              attributes: [],
              variants: [],
            },
          },
        },
      ]),
      effectiveUserId: "business-1",
    });

    const response = await GET(
      new Request("http://localhost:3000/api/business/listings?id=listing-2")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.listing).toMatchObject({
      id: "listing-2",
      status: "published",
      title: "Draft title",
      has_unpublished_changes: true,
      cover_image_id: "photo-2",
    });
    expect(payload.listingOptions).toMatchObject({
      hasOptions: false,
      attributes: [],
      variants: [],
    });
  });
});
