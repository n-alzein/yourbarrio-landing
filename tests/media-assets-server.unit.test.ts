import { beforeEach, describe, expect, it, vi } from "vitest";

const getSupabaseServerClientMock = vi.fn();
const generateAndUploadImageVariantsMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => getSupabaseServerClientMock(),
}));

vi.mock("@/lib/images/imageVariants.server", () => ({
  generateAndUploadImageVariants: (...args: unknown[]) =>
    generateAndUploadImageVariantsMock(...args),
}));

describe("media asset server lifecycle helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    getSupabaseServerClientMock.mockReset();
    generateAndUploadImageVariantsMock.mockReset();
  });

  it("includes enhanced files in media asset cleanup paths", async () => {
    const { getMediaAssetStoragePaths } = await import("@/lib/images/mediaAssets.server");

    expect(
      getMediaAssetStoragePaths({
        source_path: "tmp/user/session/asset/source",
        original_path: "tmp/user/session/asset/source",
        enhanced_path: "tmp/user/session/asset/enhanced.webp",
        thumb_path: "tmp/user/session/asset/thumb.webp",
      })
    ).toEqual(
      expect.arrayContaining([
        "tmp/user/session/asset/source",
        "tmp/user/session/asset/enhanced.webp",
        "tmp/user/session/asset/thumb.webp",
      ])
    );
  });

  it("commits enhanced temp assets using the enhanced source and removes both temp files", async () => {
    const downloadMock = vi.fn(async (path: string) => ({
      data: {
        arrayBuffer: async () =>
          new TextEncoder().encode(
            path === "tmp/user/session/asset/enhanced.webp" ? "enhanced" : "source"
          ).buffer,
      },
      error: null,
    }));
    const removeMock = vi.fn(async () => ({ error: null }));
    const updateMock = vi.fn((payload) => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: { id: "asset", ...payload },
              error: null,
            })),
          })),
        })),
      })),
    }));

    const client = {
      storage: {
        from: vi.fn(() => ({
          download: downloadMock,
          remove: removeMock,
        })),
      },
      from: vi.fn((table: string) => {
        if (table === "businesses") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: { id: "business-1", owner_user_id: "user-1" },
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === "listings") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { id: "listing-1", business_id: "user-1" },
                    error: null,
                  })),
                })),
              })),
            })),
          };
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn(async () => ({
                  data: [
                    {
                      id: "asset",
                      bucket: "business-photos",
                      owner_user_id: "user-1",
                      status: "temporary",
                      source_path: "tmp/user/session/asset/source",
                      original_path: "tmp/user/session/asset/source",
                      enhanced_path: "tmp/user/session/asset/enhanced.webp",
                    },
                  ],
                  error: null,
                })),
              })),
            })),
          })),
          update: updateMock,
        };
      }),
    };

    getSupabaseServerClientMock.mockReturnValue(client);
    generateAndUploadImageVariantsMock.mockResolvedValue({
      source_path: "user-1/listings/listing-1/asset/source.webp",
      original_path: "user-1/listings/listing-1/asset/source.webp",
      public_url: "https://example.com/source.webp",
      thumb_path: "user-1/listings/listing-1/asset/thumb_320.webp",
      card_path: "user-1/listings/listing-1/asset/card_640.webp",
      detail_path: "user-1/listings/listing-1/asset/detail_1200.webp",
    });

    const { commitTemporaryMediaAssets } = await import("@/lib/images/mediaAssets.server");
    await commitTemporaryMediaAssets({
      assetIds: ["asset"],
      businessId: "user-1",
      listingId: "listing-1",
      purpose: "listing_image",
      ownerUserId: "user-1",
    });

    expect(downloadMock).toHaveBeenCalledWith("tmp/user/session/asset/enhanced.webp");
    expect(generateAndUploadImageVariantsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceBuffer: expect.any(Buffer),
        basePath: "user-1/listings/listing-1/asset",
      })
    );
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "active",
        enhanced_path: "user-1/listings/listing-1/asset/source.webp",
      })
    );
    expect(removeMock).toHaveBeenCalledWith([
      "tmp/user/session/asset/source",
      "tmp/user/session/asset/enhanced.webp",
    ]);
  });

  it("discarding temporary media removes both source and enhanced files idempotently", async () => {
    const removeMock = vi.fn(async () => ({ error: { message: "missing object" } }));
    const updateMock = vi.fn(() => ({
      in: vi.fn(async () => ({ error: null })),
    }));
    const client = {
      storage: {
        from: vi.fn(() => ({
          remove: removeMock,
        })),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: [
                  {
                    id: "asset",
                    bucket: "business-photos",
                    owner_user_id: "user-1",
                    status: "temporary",
                    source_path: "tmp/user/session/asset/source",
                    original_path: "tmp/user/session/asset/source",
                    enhanced_path: "tmp/user/session/asset/enhanced.webp",
                  },
                ],
                error: null,
              })),
            })),
          })),
        })),
        update: updateMock,
      })),
    };
    getSupabaseServerClientMock.mockReturnValue(client);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { discardTemporaryMediaAssets } = await import("@/lib/images/mediaAssets.server");
    const result = await discardTemporaryMediaAssets({
      ownerUserId: "user-1",
      assetIds: ["asset"],
    });

    expect(result).toEqual({ deleted: 1 });
    expect(removeMock).toHaveBeenCalledWith([
      "tmp/user/session/asset/source",
      "tmp/user/session/asset/enhanced.webp",
    ]);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "deleted", deleted_at: expect.any(String) })
    );
    warnSpy.mockRestore();
  });
});
