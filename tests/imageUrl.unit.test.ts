import { describe, expect, it } from "vitest";
import { buildImageUrl } from "@/lib/imageUrl";

describe("buildImageUrl", () => {
  it("appends width, quality, and format params", () => {
    const result = buildImageUrl("/images/photo.jpg", {
      width: 800,
      quality: 70,
      format: "webp",
    });
    expect(result).toBe("/images/photo.jpg?w=800&q=70&format=webp");
  });

  it("preserves existing query and hash", () => {
    const result = buildImageUrl("/images/photo.jpg?fit=cover#section", {
      width: 400,
      version: "abc",
    });
    expect(result).toBe("/images/photo.jpg?fit=cover&w=400&v=abc#section");
  });

  it("returns data URIs unchanged", () => {
    const dataUri = "data:image/png;base64,abc123";
    expect(buildImageUrl(dataUri, { width: 100 })).toBe(dataUri);
  });
});

