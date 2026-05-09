import { beforeEach, describe, expect, it, vi } from "vitest";

const authGetUserMock = vi.fn();
const createSupabaseRouteHandlerClientMock = vi.fn();
const getMediaServiceClientMock = vi.fn();
const uploadMock = vi.fn();
const removeMock = vi.fn();
const createSignedUrlMock = vi.fn();
const insertMock = vi.fn();
const selectMock = vi.fn();
const singleMock = vi.fn();
const discardTemporaryMediaAssetsMock = vi.fn();
const commitTemporaryMediaAssetsMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseRouteHandlerClient: (...args: unknown[]) =>
    createSupabaseRouteHandlerClientMock(...args),
}));

vi.mock("@/lib/images/mediaAssets.server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/images/mediaAssets.server")>(
    "@/lib/images/mediaAssets.server"
  );
  return {
    ...actual,
    getMediaServiceClient: (...args: unknown[]) => getMediaServiceClientMock(...args),
    discardTemporaryMediaAssets: (...args: unknown[]) =>
      discardTemporaryMediaAssetsMock(...args),
    commitTemporaryMediaAssets: (...args: unknown[]) =>
      commitTemporaryMediaAssetsMock(...args),
  };
});

function mockRequest(url = "http://localhost:3000/api/media/temp-upload") {
  return {
    url,
    headers: new Headers(),
    cookies: { getAll: () => [] },
  } as unknown as Request;
}

describe("media asset lifecycle routes", () => {
  beforeEach(() => {
    vi.resetModules();
    authGetUserMock.mockReset();
    createSupabaseRouteHandlerClientMock.mockReset();
    getMediaServiceClientMock.mockReset();
    uploadMock.mockReset();
    removeMock.mockReset();
    createSignedUrlMock.mockReset();
    insertMock.mockReset();
    selectMock.mockReset();
    singleMock.mockReset();
    discardTemporaryMediaAssetsMock.mockReset();
    commitTemporaryMediaAssetsMock.mockReset();

    authGetUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    createSupabaseRouteHandlerClientMock.mockReturnValue({
      auth: { getUser: authGetUserMock },
    });
    singleMock.mockResolvedValue({
      data: {
        id: "asset-1",
        bucket: "business-photos",
        source_path: "tmp/user-1/session-1/asset-1/source",
        status: "temporary",
        purpose: "listing_image",
        upload_session_id: "session-1",
        expires_at: "2026-05-10T00:00:00.000Z",
        public_url: "https://example.supabase.co/storage/v1/object/public/business-photos/tmp/user-1/session-1/asset-1/source",
      },
      error: null,
    });
    selectMock.mockReturnValue({ single: singleMock });
    insertMock.mockReturnValue({ select: selectMock });
    uploadMock.mockResolvedValue({ error: null });
    removeMock.mockResolvedValue({ error: null });
    createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: "https://signed.example/temp" },
      error: null,
    });
    getMediaServiceClientMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          upload: uploadMock,
          remove: removeMock,
          createSignedUrl: createSignedUrlMock,
        })),
      },
      from: vi.fn(() => ({
        insert: insertMock,
      })),
    });
  });

  it("temporary upload stores a temp object and creates a temporary media asset", async () => {
    const { POST } = await import("@/app/api/media/temp-upload/route");
    const formData = new FormData();
    const file = new File(["photo"], "photo.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => new TextEncoder().encode("photo").buffer,
    });
    formData.append("file", file);
    formData.append("purpose", "listing_image");
    formData.append("upload_session_id", "session-1");

    const response = await POST({
      ...mockRequest(),
      formData: async () => formData,
    } as unknown as Request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      previewUrl: "https://signed.example/temp",
      asset: {
        id: "asset-1",
        status: "temporary",
        purpose: "listing_image",
      },
      upload_session_id: "session-1",
    });
    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^tmp\/user-1\/session-1\/[^/]+\/source$/),
      expect.any(Buffer),
      expect.objectContaining({ contentType: "image/jpeg", upsert: false })
    );
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        owner_user_id: "user-1",
        status: "temporary",
        purpose: "listing_image",
        bucket: "business-photos",
        upload_session_id: "session-1",
        expires_at: expect.any(String),
      })
    );
    expect(insertMock.mock.calls[0][0]).toEqual(
      expect.not.objectContaining({
        listing_id: expect.anything(),
        committed_at: expect.anything(),
      })
    );
  });

  it("temporary upload returns a generic error if storage write fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    uploadMock.mockResolvedValueOnce({ error: { message: "raw storage path tmp/user-1/session/source" } });
    const { POST } = await import("@/app/api/media/temp-upload/route");
    const file = new File(["photo"], "photo.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => new TextEncoder().encode("photo").buffer,
    });
    const formData = new FormData();
    formData.append("file", file);

    const response = await POST({
      ...mockRequest(),
      formData: async () => formData,
    } as unknown as Request);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error.message).toBe("Image upload failed. Please try again.");
    expect(payload.error.message).not.toContain("tmp/user-1");
    expect(consoleSpy).toHaveBeenCalledWith(
      "[media.temp-upload] failed",
      expect.objectContaining({
        message: expect.not.stringContaining("tmp/user-1/session/source"),
      })
    );
    consoleSpy.mockRestore();
  });

  it("rejects HEIC uploads gracefully", async () => {
    const { POST } = await import("@/app/api/media/temp-upload/route");
    const formData = new FormData();
    formData.append("file", new File(["photo"], "photo.heic", { type: "image/heic" }));

    const response = await POST({
      ...mockRequest(),
      formData: async () => formData,
    } as unknown as Request);
    const payload = await response.json();

    expect(response.status).toBe(415);
    expect(payload.error.code).toBe("UNSUPPORTED_HEIC");
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("discard-temp verifies through the server helper and is idempotent", async () => {
    discardTemporaryMediaAssetsMock.mockResolvedValue({ deleted: 1 });
    const { POST } = await import("@/app/api/media/discard-temp/route");

    const response = await POST({
      ...mockRequest("http://localhost:3000/api/media/discard-temp"),
      json: async () => ({ assetId: "asset-1" }),
    } as unknown as Request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, deleted: 1 });
    expect(discardTemporaryMediaAssetsMock).toHaveBeenCalledWith({
      ownerUserId: "user-1",
      assetIds: ["asset-1"],
      uploadSessionId: null,
    });
  });

  it("commit returns listing variants and profile URLs from committed assets", async () => {
    commitTemporaryMediaAssetsMock.mockResolvedValue([
      {
        id: "asset-1",
        bucket: "business-photos",
        source_path: "user-1/listings/listing-1/asset-1/source.webp",
        enhanced_path: "user-1/listings/listing-1/asset-1/source.webp",
        card_path: "user-1/listings/listing-1/asset-1/card_640.webp",
        detail_path: "user-1/listings/listing-1/asset-1/detail_1200.webp",
      },
    ]);
    const { POST } = await import("@/app/api/media/commit/route");

    const response = await POST({
      ...mockRequest("http://localhost:3000/api/media/commit"),
      json: async () => ({
        assetIds: ["asset-1"],
        listingId: "listing-1",
        businessId: "user-1",
        purpose: "listing_image",
      }),
    } as unknown as Request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.listingPhotoVariants[0]).toMatchObject({
      id: "asset-1",
      media_asset_id: "asset-1",
      variants: {
        card_640: expect.stringContaining("/business-photos/user-1/listings/listing-1/asset-1/card_640.webp"),
        detail_1200: expect.stringContaining("/business-photos/user-1/listings/listing-1/asset-1/detail_1200.webp"),
      },
      enhanced: {
        url: expect.stringContaining("/business-photos/user-1/listings/listing-1/asset-1/source.webp"),
        path: "user-1/listings/listing-1/asset-1/source.webp",
      },
    });
  });

  it("rejects listing image commits before a listing exists", async () => {
    const { POST } = await import("@/app/api/media/commit/route");

    const response = await POST({
      ...mockRequest("http://localhost:3000/api/media/commit"),
      json: async () => ({
        assetIds: ["asset-1"],
        businessId: "user-1",
        purpose: "listing_image",
      }),
    } as unknown as Request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("MISSING_LISTING");
    expect(commitTemporaryMediaAssetsMock).not.toHaveBeenCalled();
  });

  it("cleanup route requires the configured cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "secret-123");
    const { GET } = await import("@/app/api/cron/cleanup-temp-media/route");

    const response = await GET({
      ...mockRequest("http://localhost:3000/api/cron/cleanup-temp-media"),
      headers: new Headers({ authorization: "Bearer wrong" }),
    } as unknown as Request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ ok: false, error: "Unauthorized" });
    expect(getMediaServiceClientMock).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("cleanup route removes enhanced temp files with the original source", async () => {
    vi.stubEnv("CRON_SECRET", "secret-123");
    const cleanupRemoveMock = vi.fn(async () => ({ error: null }));
    const cleanupUpdateMock = vi.fn(() => ({
      in: vi.fn(async () => ({ error: null })),
    }));
    getMediaServiceClientMock.mockReturnValueOnce({
      storage: {
        from: vi.fn(() => ({
          remove: cleanupRemoveMock,
        })),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            lt: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(async () => ({
                  data: [
                    {
                      id: "asset-1",
                      bucket: "business-photos",
                      source_path: "tmp/user-1/session-1/asset-1/source",
                      original_path: "tmp/user-1/session-1/asset-1/source",
                      enhanced_path: "tmp/user-1/session-1/asset-1/enhanced.webp",
                    },
                  ],
                  error: null,
                })),
              })),
            })),
          })),
        })),
        update: cleanupUpdateMock,
      })),
    });
    const { GET } = await import("@/app/api/cron/cleanup-temp-media/route");

    const response = await GET({
      ...mockRequest("http://localhost:3000/api/cron/cleanup-temp-media"),
      headers: new Headers({ authorization: "Bearer secret-123" }),
    } as unknown as Request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, cleaned: 1 });
    expect(cleanupRemoveMock).toHaveBeenCalledWith([
      "tmp/user-1/session-1/asset-1/source",
      "tmp/user-1/session-1/asset-1/enhanced.webp",
    ]);
    vi.unstubAllEnvs();
  });
});
