import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/account/profile/route";

const { createSupabaseRouteHandlerClientMock, getSupabaseServerClientMock } = vi.hoisted(() => ({
  createSupabaseRouteHandlerClientMock: vi.fn(),
  getSupabaseServerClientMock: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseRouteHandlerClient: createSupabaseRouteHandlerClientMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: getSupabaseServerClientMock,
}));

function createRequest(body = {}) {
  return new Request("http://localhost:3000/api/account/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createSupabaseMock() {
  let usersUpdatePayload = null;
  let existingUser = { id: "user-1" };
  let updatedUser = null;

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1", email: "owner@example.com" } },
        error: null,
      }),
    },
    from: vi.fn((table) => {
      if (table !== "users") throw new Error(`Unexpected table: ${table}`);
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: updatedUser || existingUser,
              error: null,
            }),
          })),
        })),
        update: vi.fn((payload) => {
          usersUpdatePayload = payload;
          updatedUser = { id: "user-1", ...payload };
          return {
            eq: vi.fn().mockResolvedValue({ error: null, count: existingUser ? 1 : 0 }),
          };
        }),
      };
    }),
    get usersUpdatePayload() {
      return usersUpdatePayload;
    },
    set existingUser(value) {
      existingUser = value;
    },
  };
}

describe("POST /api/account/profile phone normalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseServerClientMock.mockReturnValue(null);
  });

  it("updates private user phone only", async () => {
    const supabase = createSupabaseMock();
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase);

    const response = await POST(createRequest({ phone: "562-123-4567" }));

    expect(response.status).toBe(200);
    expect(supabase.from).toHaveBeenCalledWith("users");
    expect(supabase.from).not.toHaveBeenCalledWith("businesses");
    expect(supabase.usersUpdatePayload).toEqual(
      expect.objectContaining({ phone: "(562) 123-4567" })
    );
  });

  it("persists full name and returns the updated safe profile", async () => {
    const supabase = createSupabaseMock();
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase);

    const response = await POST(createRequest({ full_name: "  Test Customer  " }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(supabase.usersUpdatePayload).toEqual(
      expect.objectContaining({ full_name: "Test Customer" })
    );
    expect(payload.profile).toEqual(
      expect.objectContaining({
        id: "user-1",
        full_name: "Test Customer",
      })
    );
  });

  it("persists customer address fields and returns them in the updated profile", async () => {
    const supabase = createSupabaseMock();
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase);

    const response = await POST(
      createRequest({
        address: "123 Main St",
        address_2: "Apt 4",
        city: "Long Beach",
        state: "ca",
        postal_code: "90802",
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(supabase.usersUpdatePayload).toEqual(
      expect.objectContaining({
        address: "123 Main St",
        address_2: "Apt 4",
        city: "Long Beach",
        state: "CA",
        postal_code: "90802",
      })
    );
    expect(payload.profile).toEqual(
      expect.objectContaining({
        address: "123 Main St",
        address_2: "Apt 4",
        city: "Long Beach",
        state: "CA",
        postal_code: "90802",
      })
    );
  });

  it("rejects incomplete non-empty private phone values", async () => {
    const supabase = createSupabaseMock();
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase);

    const response = await POST(createRequest({ phone: "562" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Enter a complete 10-digit US phone number.",
    });
    expect(supabase.usersUpdatePayload).toBeNull();
  });

  it("allows empty private phone values", async () => {
    const supabase = createSupabaseMock();
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase);

    const response = await POST(createRequest({ phone: "" }));

    expect(response.status).toBe(200);
    expect(supabase.usersUpdatePayload).toEqual(expect.objectContaining({ phone: null }));
  });

  it("returns an error when no public user row is updated", async () => {
    const supabase = createSupabaseMock();
    supabase.existingUser = null;
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase);

    const response = await POST(createRequest({ full_name: "Test User" }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Account profile was not found.",
    });
    expect(supabase.usersUpdatePayload).toBeNull();
  });
});
