import { beforeEach, describe, expect, it, vi } from "vitest";

const heic2anyMock = vi.fn();

vi.mock("heic2any", () => ({
  default: (...args: unknown[]) => heic2anyMock(...args),
}));

describe("normalizeImageUpload", () => {
  beforeEach(() => {
    heic2anyMock.mockReset();
  });

  it("detects HEIC/HEIF files by mime type and extension", async () => {
    const { isHeicLikeFile } = await import("@/lib/normalizeImageUpload");

    expect(isHeicLikeFile(new File(["x"], "photo.heic", { type: "image/heic" }))).toBe(true);
    expect(isHeicLikeFile(new File(["x"], "photo.HEIF", { type: "" }))).toBe(true);
    expect(isHeicLikeFile(new File(["x"], "photo.jpg", { type: "image/jpeg" }))).toBe(false);
  });

  it("returns non-HEIC files unchanged", async () => {
    const { normalizeImageUpload } = await import("@/lib/normalizeImageUpload");
    const file = new File(["jpeg"], "photo.jpg", { type: "image/jpeg" });

    const result = await normalizeImageUpload(file);

    expect(result).toBe(file);
    expect(heic2anyMock).not.toHaveBeenCalled();
  });

  it("converts HEIC files to jpeg", async () => {
    const { normalizeImageUpload } = await import("@/lib/normalizeImageUpload");
    heic2anyMock.mockResolvedValue(new Blob(["converted"], { type: "image/jpeg" }));

    const file = new File(["heic"], "IMG_0001.HEIC", { type: "image/heic" });
    const result = await normalizeImageUpload(file);

    expect(heic2anyMock).toHaveBeenCalledWith({
      blob: file,
      toType: "image/jpeg",
      quality: 0.92,
    });
    expect(result).toBeInstanceOf(File);
    expect(result.name).toBe("IMG_0001.jpg");
    expect(result.type).toBe("image/jpeg");
  });

  it("throws a user-friendly error when HEIC conversion fails", async () => {
    const { normalizeImageUpload } = await import("@/lib/normalizeImageUpload");
    heic2anyMock.mockRejectedValue(new Error("decode failed"));

    await expect(
      normalizeImageUpload(new File(["heic"], "IMG_0001.heic", { type: "image/heic" }))
    ).rejects.toThrow("We couldn't process this iPhone photo. Please try a different image.");
  });
});
