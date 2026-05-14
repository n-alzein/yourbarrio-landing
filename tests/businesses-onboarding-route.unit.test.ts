import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/businesses/route";

const { createSupabaseRouteHandlerClientMock } = vi.hoisted(() => ({
  createSupabaseRouteHandlerClientMock: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseRouteHandlerClient: createSupabaseRouteHandlerClientMock,
}));

function createRequest(body = {}) {
  return new Request("http://localhost:3000/api/businesses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Vitest Browser",
    },
    body: JSON.stringify({
      name: "Cafe Uno",
      category: "Cafe",
      description: "Great coffee",
      address: "123 Main St",
      city: "Long Beach",
      state: "CA",
      postal_code: "90802",
      notifications_phone: "+1 562 555 0101",
      notifications_phone_verified: false,
      business_terms_accepted: true,
      ...body,
    }),
  });
}

function createSupabaseMock({
  rpcError = null,
  existingUserOverride = {},
  existingBusinessOverride = {},
  businessRowOverride = {},
  businessUpsertError = null,
  userUpsertError = null,
  authEmail = "biz@example.com",
} = {}) {
  const businessRow = {
    id: "biz-1",
    owner_user_id: "11111111-1111-4111-8111-111111111111",
    public_id: "abc123",
    business_name: "Cafe Uno",
    category: "Cafe",
    business_type_id: "type-food",
    address: "123 Main St",
    city: "Long Beach",
    state: "CA",
    postal_code: "90802",
    verification_status: "pending",
    ...businessRowOverride,
  };

  const usersTable = {
    upsert: vi.fn().mockResolvedValue({
      error: userUpsertError,
    }),
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { public_id: "abc123", latitude: null, longitude: null, ...existingUserOverride },
          error: null,
        }),
      })),
    })),
  };

  const businessesTable = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { latitude: null, longitude: null, ...existingBusinessOverride },
          error: null,
        }),
      })),
    })),
    upsert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: businessRow,
          error: businessUpsertError,
        }),
      })),
    })),
  };
  const businessTypesTable = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "type-food", slug: "food-drink", name: "Food & Drink" },
            error: null,
          }),
        })),
      })),
    })),
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: "11111111-1111-4111-8111-111111111111",
            email: authEmail,
          },
        },
        error: null,
      }),
    },
    rpc: vi.fn().mockResolvedValue({ error: rpcError }),
    from: vi.fn((table) => {
      if (table === "users") return usersTable;
      if (table === "businesses") return businessesTable;
      if (table === "business_types") return businessTypesTable;
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe("POST /api/businesses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_GEOCODING_API_KEY = "";
  });

  it("returns 400 when set_my_role_business RPC fails", async () => {
    const supabase = createSupabaseMock({
      rpcError: { code: "42501", message: "permission denied" },
    });
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase);

    const response = await POST(createRequest());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "permission denied",
    });
    expect(supabase.rpc).toHaveBeenCalledWith("set_my_role_business");
  });

  it("returns 400 when business terms acceptance is missing", async () => {
    const supabase = createSupabaseMock();
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase);

    const response = await POST(createRequest({ business_terms_accepted: false }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error:
        "You need to confirm authorization and accept the required policies before continuing.",
    });
    expect(supabase.from("users").upsert).not.toHaveBeenCalled();
    expect(supabase.from("businesses").upsert).not.toHaveBeenCalled();
  });

  it("stores business terms acceptance metadata on first accepted submission", async () => {
    const supabase = createSupabaseMock();
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase);

    const response = await POST(createRequest({ business_terms_accepted: true }));

    expect(response.status).toBe(200);
    expect(supabase.from("businesses").upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        business_terms_accepted_at: expect.any(String),
        business_terms_version: "May 2026",
        business_terms_accepted_by_user_id: "11111111-1111-4111-8111-111111111111",
        business_terms_acceptance_user_agent: "Vitest Browser",
      }),
      expect.any(Object)
    );
  });

  it("preserves existing business terms acceptance metadata on later profile saves", async () => {
    const supabase = createSupabaseMock({
      existingBusinessOverride: {
        business_terms_accepted_at: "2026-05-01T00:00:00.000Z",
        business_terms_version: "May 2026",
        business_terms_accepted_by_user_id: "22222222-2222-4222-8222-222222222222",
      },
    });
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase);

    const response = await POST(createRequest({ business_terms_accepted: false }));

    expect(response.status).toBe(200);
    expect(supabase.from("businesses").upsert).toHaveBeenCalledWith(
      expect.not.objectContaining({
        business_terms_accepted_at: expect.anything(),
        business_terms_version: expect.anything(),
        business_terms_accepted_by_user_id: expect.anything(),
        business_terms_acceptance_user_agent: expect.anything(),
      }),
      expect.any(Object)
    );
  });

  it("returns 400 when business row is still incomplete after successful RPC", async () => {
    const supabase = createSupabaseMock({
      businessRowOverride: {
        address: "",
      },
    });
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase);

    const response = await POST(createRequest());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Business profile is incomplete after save.",
    });
    expect(supabase.rpc).toHaveBeenCalledWith("set_my_role_business");
  });

  it("syncs users.full_name and users.business_name to the submitted business name", async () => {
    const supabase = createSupabaseMock();
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase);

    const response = await POST(createRequest({ name: "Pan Dulce Market" }));
    expect(response.status).toBe(200);

    expect(supabase.from).toHaveBeenCalledWith("users");
    expect(supabase.from("users").upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "11111111-1111-4111-8111-111111111111",
        email: "biz@example.com",
        role: "business",
        full_name: "Pan Dulce Market",
        business_name: "Pan Dulce Market",
      }),
      {
        onConflict: "id",
        ignoreDuplicates: false,
      }
    );
  });

  it("fills users.email from the authenticated auth user, not onboarding form data", async () => {
    const supabase = createSupabaseMock({ authEmail: "  BizOwner@Example.COM  " });
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase);

    const response = await POST(createRequest({ email: "attacker@example.com" }));
    expect(response.status).toBe(200);

    expect(supabase.from("users").upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "bizowner@example.com",
      }),
      expect.any(Object)
    );
  });

  it("does not overwrite an existing user email with blank auth email during onboarding", async () => {
    const supabase = createSupabaseMock({
      authEmail: "",
      existingUserOverride: { email: "existing@example.com" },
    });
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase);

    const response = await POST(createRequest());
    expect(response.status).toBe(200);

    expect(supabase.from("users").upsert).toHaveBeenCalledWith(
      expect.not.objectContaining({ email: expect.anything() }),
      expect.any(Object)
    );
  });

  it("saves notifications phone to user account and public phone to business record", async () => {
    const supabase = createSupabaseMock({
      businessRowOverride: {
        phone: "(562) 123-4567",
      },
    });
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase);

    const response = await POST(createRequest({ phone: "+1 562 123 4567" }));
    expect(response.status).toBe(200);

    expect(supabase.from("users").upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "(562) 555-0101",
      }),
      expect.any(Object)
    );
    expect(supabase.from("businesses").upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        business_type_id: "type-food",
        phone_verified_at: null,
        phone: "(562) 123-4567",
      }),
      {
        onConflict: "owner_user_id",
        ignoreDuplicates: false,
      }
    );
  });

  it("does not include internal flags in normal onboarding upserts", async () => {
    const supabase = createSupabaseMock();
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase);

    const response = await POST(createRequest({ is_internal: true }));
    expect(response.status).toBe(200);

    expect(supabase.from("users").upsert).toHaveBeenCalledWith(
      expect.not.objectContaining({ is_internal: expect.anything() }),
      expect.any(Object)
    );
    expect(supabase.from("businesses").upsert).toHaveBeenCalledWith(
      expect.not.objectContaining({ is_internal: expect.anything() }),
      expect.any(Object)
    );
  });

  it("updates an existing incomplete business with public phone while account phone stays notifications-only", async () => {
    const supabase = createSupabaseMock({
      existingUserOverride: {
        phone: "(562) 000-0000",
        is_internal: true,
      },
      existingBusinessOverride: {
        phone: "(562) 111-1111",
        is_internal: true,
      },
      businessRowOverride: {
        phone: "(562) 222-2222",
      },
    });
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase);

    const response = await POST(
      createRequest({
        notifications_phone: "+1 562 555 0101",
        phone: "+1 562 222 2222",
      })
    );

    expect(response.status).toBe(200);
    expect(supabase.from("users").upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "(562) 555-0101",
      }),
      expect.any(Object)
    );
    expect(supabase.from("users").upsert).toHaveBeenCalledWith(
      expect.not.objectContaining({
        phone: "(562) 222-2222",
        is_internal: expect.anything(),
      }),
      expect.any(Object)
    );
    expect(supabase.from("businesses").upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "(562) 222-2222",
      }),
      expect.any(Object)
    );
    expect(supabase.from("businesses").upsert).toHaveBeenCalledWith(
      expect.not.objectContaining({ is_internal: expect.anything() }),
      expect.any(Object)
    );
  });

  it("rejects missing notifications phone", async () => {
    const supabase = createSupabaseMock();
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase);

    const response = await POST(
      createRequest({ notifications_phone: "", notifications_phone_verified: true })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Notifications phone is required.",
    });
  });

  it("allows unverified notifications phone during pre-Twilio onboarding", async () => {
    const supabase = createSupabaseMock();
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase);

    const response = await POST(
      createRequest({ notifications_phone_verified: false })
    );

    expect(response.status).toBe(200);
    expect(supabase.from("users").upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "(562) 555-0101",
      }),
      expect.any(Object)
    );
  });

  it("rejects incomplete non-empty public phone numbers", async () => {
    const supabase = createSupabaseMock();
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase);

    const response = await POST(createRequest({ phone: "562" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Enter a complete 10-digit US phone number.",
    });
  });

  it("returns success only when RPC succeeds and business row is complete", async () => {
    const supabase = createSupabaseMock();
    createSupabaseRouteHandlerClientMock.mockReturnValue(supabase);

    const response = await POST(createRequest());
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.owner_user_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(payload.row.business_name).toBe("Cafe Uno");
    expect(supabase.rpc).toHaveBeenCalledWith("set_my_role_business");
  });
});
