import { beforeEach, describe, expect, it, vi } from "vitest";

const getBusinessDataClientForRequestMock = vi.fn();
const enhancePhotoWithPhotoroomMock = vi.fn();
const getMediaServiceClientMock = vi.fn();
const uploadMock = vi.fn();
const mediaUpdateMock = vi.fn();
const mediaMaybeSingleMock = vi.fn();
const assertBusinessCanUseFeatureMock = vi.fn();
const consumeBusinessUsageMock = vi.fn();

vi.mock("@/lib/business/getBusinessDataClientForRequest", () => ({
  getBusinessDataClientForRequest: (...args) =>
    getBusinessDataClientForRequestMock(...args),
}));

vi.mock("@/lib/server/photoroom", async () => {
  const actual = await vi.importActual("@/lib/server/photoroom");
  return {
    ...actual,
    enhancePhotoWithPhotoroom: (...args) => enhancePhotoWithPhotoroomMock(...args),
  };
});

vi.mock("@/lib/images/mediaAssets.server", async () => {
  const actual = await vi.importActual("@/lib/images/mediaAssets.server");
  return {
    ...actual,
    MEDIA_BUCKET: "business-photos",
    getMediaServiceClient: (...args) => getMediaServiceClientMock(...args),
  };
});

vi.mock("@/lib/monetization/entitlements", async () => {
  const actual = await vi.importActual("@/lib/monetization/entitlements");
  return {
    ...actual,
    assertBusinessCanUseFeature: (...args) => assertBusinessCanUseFeatureMock(...args),
    consumeBusinessUsage: (...args) => consumeBusinessUsageMock(...args),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(() => ({})),
}));

describe("POST /api/images/enhance", () => {
  beforeEach(() => {
    getBusinessDataClientForRequestMock.mockReset();
    enhancePhotoWithPhotoroomMock.mockReset();
    getMediaServiceClientMock.mockReset();
    uploadMock.mockReset();
    mediaUpdateMock.mockReset();
    mediaMaybeSingleMock.mockReset();
    assertBusinessCanUseFeatureMock.mockReset();
    consumeBusinessUsageMock.mockReset();

    uploadMock.mockResolvedValue({ error: null });
    assertBusinessCanUseFeatureMock.mockResolvedValue(undefined);
    consumeBusinessUsageMock.mockResolvedValue(undefined);
    mediaUpdateMock.mockReturnValue({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(async () => ({ error: null })),
        })),
      })),
    });
    mediaMaybeSingleMock.mockResolvedValue({
      data: {
        id: "asset-1",
        bucket: "business-photos",
        source_path: "tmp/user-1/session-1/asset-1/source",
      },
      error: null,
    });

    getBusinessDataClientForRequestMock.mockResolvedValue({
      ok: true,
      businessId: "business-1",
      effectiveUserId: "user-1",
      client: {},
    });
    getMediaServiceClientMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          upload: uploadMock,
        })),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: mediaMaybeSingleMock,
              })),
            })),
          })),
        })),
        update: mediaUpdateMock,
      })),
    });
  });

  it("normalizes a successful enhancement response", async () => {
    enhancePhotoWithPhotoroomMock.mockResolvedValue({
      buffer: new TextEncoder().encode("enhanced").buffer,
      contentType: "image/png",
      extension: "png",
      background: "white",
      lighting: "auto",
      shadow: "subtle",
      transformed: true,
    });

    const { POST } = await import("@/app/api/images/enhance/route");
    const formData = new FormData();
    formData.append("image", new File(["photo"], "listing.jpg", { type: "image/jpeg" }));
    formData.append("background", "white");
    formData.append("mediaAssetId", "asset-1");

    const response = await POST({
      formData: async () => formData,
      headers: new Headers({ "x-forwarded-for": "127.0.0.1" }),
    } as unknown as Request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      image: {
        publicUrl: expect.stringContaining("/business-photos/tmp/user-1/session-1/asset-1/enhanced.webp"),
        path: "tmp/user-1/session-1/asset-1/enhanced.webp",
      },
      enhancement: {
        background: "white",
        lighting: "auto",
        shadow: "subtle",
      },
    });
    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(uploadMock).toHaveBeenCalledWith(
      "tmp/user-1/session-1/asset-1/enhanced.webp",
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: "image/png", upsert: true })
    );
    expect(mediaUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        enhanced_path: "tmp/user-1/session-1/asset-1/enhanced.webp",
      })
    );
    expect(consumeBusinessUsageMock).toHaveBeenCalledTimes(1);
  });

  it("does not upload or label fallback original output as enhanced", async () => {
    enhancePhotoWithPhotoroomMock.mockResolvedValue({
      buffer: new TextEncoder().encode("original").buffer,
      contentType: "image/jpeg",
      extension: "jpg",
      background: "white",
      lighting: "auto",
      shadow: "subtle",
      transformed: false,
    });

    const { POST } = await import("@/app/api/images/enhance/route");
    const formData = new FormData();
    formData.append("image", new File(["photo"], "listing.jpg", { type: "image/jpeg" }));
    formData.append("background", "white");
    formData.append("imageSource", "mobile_camera");
    formData.append("mediaAssetId", "asset-1");

    const response = await POST({
      formData: async () => formData,
      headers: new Headers({ "x-forwarded-for": "127.0.0.1" }),
    } as unknown as Request);
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload).toMatchObject({
      ok: false,
      error: {
        code: "ENHANCEMENT_UNUSABLE",
        message: "We couldn't enhance this photo right now. You can keep the original and continue.",
      },
      debug: {
        stage: "provider_response",
      },
    });
    expect(uploadMock).not.toHaveBeenCalled();
    expect(consumeBusinessUsageMock).not.toHaveBeenCalled();
  });

  it("normalizes upstream failures without leaking raw details", async () => {
    enhancePhotoWithPhotoroomMock.mockRejectedValue(
      Object.assign(new Error("raw upstream body"), { status: 502, requestId: "req_123" })
    );

    const { POST } = await import("@/app/api/images/enhance/route");
    const formData = new FormData();
    formData.append("image", new File(["photo"], "listing.jpg", { type: "image/jpeg" }));
    formData.append("mediaAssetId", "asset-1");

    const response = await POST({
      formData: async () => formData,
      headers: new Headers({ "x-forwarded-for": "127.0.0.1" }),
    } as unknown as Request);
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload).toMatchObject({
      ok: false,
      error: {
        code: "ENHANCEMENT_FAILED",
        message: "We couldn't enhance this photo right now. You can keep the original and continue.",
      },
      debug: {
        stage: "unknown",
        status: 502,
      },
    });
    expect(consumeBusinessUsageMock).not.toHaveBeenCalled();
  });
});
