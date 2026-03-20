import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/refresh/route";

const { createSupabaseRouteHandlerClientMock, clearSupabaseCookiesMock } = vi.hoisted(() => ({
  createSupabaseRouteHandlerClientMock: vi.fn(),
  clearSupabaseCookiesMock: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseRouteHandlerClient: createSupabaseRouteHandlerClientMock,
  isRefreshTokenAlreadyUsedError: (error: any) =>
    error?.code === "refresh_token_already_used",
}));

vi.mock("@/lib/authCookies", () => ({
  clearSupabaseCookies: clearSupabaseCookiesMock,
}));

function createRequest(body: Record<string, unknown> = {}) {
  return new Request("http://localhost:3000/api/auth/refresh", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("confirms the SSR-visible user after setSession", async () => {
    createSupabaseRouteHandlerClientMock.mockReturnValue({
      auth: {
        setSession: vi.fn().mockResolvedValue({ error: null }),
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: "access" } },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    });

    const response = await POST(
      createRequest({ access_token: "access", refresh_token: "refresh" })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-auth-refresh-user")).toBe("1");
    expect(clearSupabaseCookiesMock).not.toHaveBeenCalled();
  });

  it("clears auth cookies when Supabase reports refresh_token_already_used", async () => {
    createSupabaseRouteHandlerClientMock.mockReturnValue({
      auth: {
        setSession: vi.fn().mockResolvedValue({
          error: { code: "refresh_token_already_used", message: "already used" },
        }),
        getSession: vi.fn(),
        getUser: vi.fn(),
      },
    });

    const response = await POST(
      createRequest({ access_token: "access", refresh_token: "refresh" })
    );

    expect(response.status).toBe(401);
    expect(clearSupabaseCookiesMock).toHaveBeenCalledTimes(1);
  });
});
