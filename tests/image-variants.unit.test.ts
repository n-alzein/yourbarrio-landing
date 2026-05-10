import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { generateAndUploadImageVariants } from "@/lib/images/imageVariants.server";

function createStorageRecorder() {
  const uploads: Array<{ path: string; buffer: Buffer; options: Record<string, unknown> }> = [];
  const upload = vi.fn(async (path: string, buffer: Buffer, options: Record<string, unknown>) => {
    uploads.push({ path, buffer, options });
    return { error: null };
  });
  return {
    uploads,
    storage: {
      from: vi.fn(() => ({ upload })),
    },
  };
}

async function getImageSize(buffer: Buffer) {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width,
    height: metadata.height,
  };
}

describe("image variant generation", () => {
  it("generates high-quality business avatar variants from the uploaded source", async () => {
    const sourceBuffer = await sharp({
      create: {
        width: 900,
        height: 700,
        channels: 3,
        background: { r: 24, g: 86, b: 180 },
      },
    })
      .png()
      .toBuffer();
    const { storage, uploads } = createStorageRecorder();

    const result = await generateAndUploadImageVariants({
      storage,
      bucket: "business-photos",
      sourceBuffer,
      purpose: "business_avatar",
      basePath: "owner/avatar/asset",
    });

    expect(result).toMatchObject({
      source_path: "owner/avatar/asset/source.webp",
      avatar_128_path: "owner/avatar/asset/avatar_128.webp",
      avatar_256_path: "owner/avatar/asset/avatar_256.webp",
      avatar_512_path: "owner/avatar/asset/avatar_512.webp",
      width: 900,
      height: 700,
    });
    expect(uploads.map((item) => item.path)).toEqual([
      "owner/avatar/asset/source.webp",
      "owner/avatar/asset/avatar_128.webp",
      "owner/avatar/asset/avatar_256.webp",
      "owner/avatar/asset/avatar_512.webp",
    ]);

    const byPath = new Map(uploads.map((item) => [item.path, item.buffer]));
    await expect(getImageSize(byPath.get("owner/avatar/asset/source.webp") as Buffer)).resolves.toEqual({
      width: 900,
      height: 700,
    });
    await expect(getImageSize(byPath.get("owner/avatar/asset/avatar_512.webp") as Buffer)).resolves.toEqual({
      width: 512,
      height: 512,
    });
  });

  it("does not upscale low-resolution business avatar sources", async () => {
    const sourceBuffer = await sharp({
      create: {
        width: 180,
        height: 180,
        channels: 3,
        background: { r: 245, g: 246, b: 248 },
      },
    })
      .png()
      .toBuffer();
    const { storage, uploads } = createStorageRecorder();

    await generateAndUploadImageVariants({
      storage,
      bucket: "business-photos",
      sourceBuffer,
      purpose: "business_avatar",
      basePath: "owner/avatar/small-asset",
    });

    const byPath = new Map(uploads.map((item) => [item.path, item.buffer]));
    await expect(getImageSize(byPath.get("owner/avatar/small-asset/avatar_512.webp") as Buffer)).resolves.toEqual({
      width: 180,
      height: 180,
    });
  });
});
