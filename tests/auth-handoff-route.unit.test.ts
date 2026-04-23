import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentAccountContextMock, noStoreMock } = vi.hoisted(() => ({
  getCurrentAccountContextMock: vi.fn(),
  noStoreMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  unstable_noStore: noStoreMock,
}));

vi.mock("@/lib/auth/getCurrentAccountContext", () => ({
  getCurrentAccountContext: getCurrentAccountContextMock,
}));

async function importRoute() {
  vi.resetModules();
  return import("../app/auth/handoff/route.js");
}

describe("auth handoff route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forces a fresh authenticated landing redirect when auth cookies are visible", async () => {
    getCurrentAccountContextMock.mockResolvedValue({
      isAuthenticated: true,
      user: { id: "user-1" },
      profile: { id: "user-1" },
      role: "customer",
    });
    const { GET } = await importRoute();

    const response = await GET(
      new Request("https://www.yourbarrio.com/auth/handoff?next=/customer/home")
    );
    const location = response.headers.get("location") || "";
    const parsed = new URL(location);

    expect(noStoreMock).toHaveBeenCalledTimes(1);
    expect(getCurrentAccountContextMock).toHaveBeenCalledWith({
      source: "auth-handoff",
    });
    expect(response.status).toBe(303);
    expect(parsed.origin).toBe("https://yourbarrio.com");
    expect(parsed.pathname).toBe("/customer/home");
    expect(parsed.searchParams.get("yb_auth_handoff")).toBe("1");
    expect(parsed.searchParams.get("yb_auth_fresh")).toBeTruthy();
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    expect(response.headers.get("x-auth-handoff-user")).toBe("1");
  });

  it("redirects safely to login when the handoff cannot see an auth user", async () => {
    getCurrentAccountContextMock.mockResolvedValue({
      isAuthenticated: false,
      user: null,
      profile: null,
      role: null,
    });
    const { GET } = await importRoute();

    const response = await GET(
      new Request("https://www.yourbarrio.com/auth/handoff?next=/customer/home")
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://yourbarrio.com/login?next=%2Fcustomer%2Fhome&auth=session_missing"
    );
    expect(response.headers.get("x-auth-handoff-user")).toBe("0");
  });

  it("rejects unsafe next paths", async () => {
    getCurrentAccountContextMock.mockResolvedValue({
      isAuthenticated: true,
      user: { id: "user-1" },
      profile: null,
      role: "customer",
    });
    const { GET } = await importRoute();

    const response = await GET(
      new Request("https://www.yourbarrio.com/auth/handoff?next=https://evil.test")
    );
    const parsed = new URL(response.headers.get("location") || "");

    expect(parsed.origin).toBe("https://yourbarrio.com");
    expect(parsed.pathname).toBe("/");
    expect(parsed.searchParams.get("yb_auth_handoff")).toBe("1");
  });
});
