import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getBusinessPhoto } from "@/app/business-photos/[...path]/route";
import { GET as getBusinessGalleryPhoto } from "@/app/business-gallery/[...path]/route";

describe("legacy business media proxy routes", () => {
  const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
    vi.restoreAllMocks();
  });

  it("redirects existing legacy business photo paths to Supabase public storage", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true })
    );

    const response = await getBusinessPhoto(
      new Request("http://localhost:3000/business-photos/avatar.jpg"),
      { params: Promise.resolve({ path: ["avatar.jpg"] }) }
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://example.supabase.co/storage/v1/object/public/business-photos/avatar.jpg"
    );
  });

  it("redirects missing legacy business photo paths to a safe placeholder", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false })
    );

    const response = await getBusinessPhoto(
      new Request("http://localhost:3000/business-photos/missing.jpg"),
      { params: Promise.resolve({ path: ["missing.jpg"] }) }
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/business-placeholder.png"
    );
  });

  it("redirects missing legacy gallery paths to a safe placeholder", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false })
    );

    const response = await getBusinessGalleryPhoto(
      new Request("http://localhost:3000/business-gallery/missing.jpg"),
      { params: Promise.resolve({ path: ["missing.jpg"] }) }
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/business-placeholder.png"
    );
  });
});
