import { beforeEach, describe, expect, it, vi } from "vitest";

const getBusinessDataClientForRequestMock = vi.fn();
const enhancePhotoWithPhotoroomMock = vi.fn();
const uploadMock = vi.fn();
const getPublicUrlMock = vi.fn();

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

describe("POST /api/images/enhance", () => {
  beforeEach(() => {
    getBusinessDataClientForRequestMock.mockReset();
    enhancePhotoWithPhotoroomMock.mockReset();
    uploadMock.mockReset();
    getPublicUrlMock.mockReset();

    uploadMock.mockResolvedValue({ error: null });
    getPublicUrlMock.mockReturnValue({
      data: { publicUrl: "https://example.com/enhanced.png" },
    });

    getBusinessDataClientForRequestMock.mockResolvedValue({
      ok: true,
      effectiveUserId: "user-1",
      client: {
        storage: {
          from: vi.fn(() => ({
            upload: uploadMock,
            getPublicUrl: getPublicUrlMock,
          })),
        },
      },
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
    });

    const { POST } = await import("@/app/api/images/enhance/route");
    const formData = new FormData();
    formData.append("image", new File(["photo"], "listing.jpg", { type: "image/jpeg" }));
    formData.append("background", "white");

    const response = await POST({
      formData: async () => formData,
      headers: new Headers({ "x-forwarded-for": "127.0.0.1" }),
    } as unknown as Request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      image: {
        publicUrl: "https://example.com/enhanced.png",
      },
      enhancement: {
        background: "white",
        lighting: "auto",
        shadow: "subtle",
      },
    });
    expect(uploadMock).toHaveBeenCalledTimes(1);
  });

  it("normalizes upstream failures without leaking raw details", async () => {
    enhancePhotoWithPhotoroomMock.mockRejectedValue(
      Object.assign(new Error("raw upstream body"), { status: 502, requestId: "req_123" })
    );

    const { POST } = await import("@/app/api/images/enhance/route");
    const formData = new FormData();
    formData.append("image", new File(["photo"], "listing.jpg", { type: "image/jpeg" }));

    const response = await POST({
      formData: async () => formData,
      headers: new Headers({ "x-forwarded-for": "127.0.0.1" }),
    } as unknown as Request);
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload).toEqual({
      ok: false,
      error: {
        code: "ENHANCEMENT_FAILED",
        message: "We couldn't enhance this photo right now. You can keep the original and continue.",
      },
    });
  });
});
