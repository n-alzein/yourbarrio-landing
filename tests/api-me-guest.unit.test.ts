import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentAccountContextMock } = vi.hoisted(() => ({
  getCurrentAccountContextMock: vi.fn(),
}));

vi.mock("@/lib/auth/getCurrentAccountContext", () => ({
  getCurrentAccountContext: getCurrentAccountContextMock,
}));

import { GET } from "@/app/api/me/route";

describe("GET /api/me guest state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 with explicit guest account context for anonymous visitors", async () => {
    getCurrentAccountContextMock.mockResolvedValue({
      user: null,
      profile: null,
      role: null,
      isAuthenticated: false,
      isRoleResolved: true,
      businessRowExists: false,
      canPurchase: false,
      isBusiness: false,
    });

    const response = await GET(new Request("http://localhost:3000/api/me"));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({
      user: null,
      profile: null,
      accountContext: {
        role: "guest",
        isRoleResolved: true,
        businessRowExists: false,
        canPurchase: false,
        isBusiness: false,
        isAuthenticated: false,
      },
    });
  });
});
