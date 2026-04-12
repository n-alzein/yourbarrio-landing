import { describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import CustomerBusinessProfilePage from "@/app/(customer)/customer/b/[id]/page";

describe("customer business profile redirect", () => {
  it("redirects the legacy customer route to the canonical public route", async () => {
    await expect(
      CustomerBusinessProfilePage({
        params: Promise.resolve({ id: "biz-123" }),
        searchParams: Promise.resolve({ preview: "1", perf: "1" }),
      })
    ).rejects.toThrow("NEXT_REDIRECT:/b/biz-123?preview=1&perf=1");

    expect(redirectMock).toHaveBeenCalledWith("/b/biz-123?preview=1&perf=1");
  });
});
