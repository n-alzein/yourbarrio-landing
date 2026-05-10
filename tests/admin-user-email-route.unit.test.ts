import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/admin/users/[id]/email/route";

const { auditMock, getAdminServiceRoleClientMock, requireAdminApiRoleMock } = vi.hoisted(() => ({
  auditMock: vi.fn(),
  getAdminServiceRoleClientMock: vi.fn(),
  requireAdminApiRoleMock: vi.fn(),
}));

vi.mock("@/lib/admin/audit", () => ({
  audit: auditMock,
}));

vi.mock("@/lib/admin/requireAdminApiRole", () => ({
  requireAdminApiRole: requireAdminApiRoleMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminServiceRoleClient: getAdminServiceRoleClientMock,
}));

function createRequest(body = {}) {
  return new Request(
    "http://localhost:3000/api/admin/users/11111111-1111-4111-8111-111111111111/email",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newEmail: " NewOwner@Example.COM ",
        reason: "Verified owner requested account email update.",
        ...body,
      }),
    }
  );
}

function createAdminClient() {
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq: updateEq }));
  const from = vi.fn((table: string) => {
    if (table !== "users") throw new Error(`Unexpected table: ${table}`);
    return { update };
  });
  const signOut = vi.fn().mockResolvedValue({ error: null });
  const updateUserById = vi.fn().mockResolvedValue({ error: null });
  const getUserById = vi.fn().mockResolvedValue({
    data: { user: { id: "11111111-1111-4111-8111-111111111111", email: "old@example.com" } },
    error: null,
  });

  return {
    auth: {
      admin: {
        getUserById,
        updateUserById,
        signOut,
      },
    },
    from,
    __mocks: {
      from,
      update,
      updateEq,
      getUserById,
      updateUserById,
      signOut,
    },
  };
}

describe("POST /api/admin/users/[id]/email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminApiRoleMock.mockResolvedValue({
      ok: true,
      actorUser: { id: "admin-1", email: "admin@example.com" },
    });
  });

  it("syncs public.users.email after auth email is changed", async () => {
    const adminClient = createAdminClient();
    getAdminServiceRoleClientMock.mockReturnValue(adminClient);

    const response = await POST(createRequest(), {
      params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
    });

    expect(response.status).toBe(200);
    expect(adminClient.__mocks.updateUserById).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      { email: "newowner@example.com" }
    );
    expect(adminClient.__mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "newowner@example.com",
        updated_at: expect.any(String),
      })
    );
    expect(adminClient.__mocks.updateEq).toHaveBeenCalledWith(
      "id",
      "11111111-1111-4111-8111-111111111111"
    );
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.user.update_email",
      })
    );
  });
});
