import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getAdminRoleMembersSelectMock } = vi.hoisted(() => ({
  getAdminRoleMembersSelectMock: vi.fn(),
}));

import { fetchAdminUsers } from "@/lib/admin/users";

function createClientForBusinessRpc() {
  return {
    rpc: vi.fn((fn: string, args: Record<string, unknown>) => {
      if (fn !== "admin_list_accounts") {
        return Promise.resolve({ data: [], error: null });
      }

      expect(args.p_role).toBe("business");
      expect(args.p_internal).toBe(true);

      return Promise.resolve({
        data: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            email: "biz@example.com",
            full_name: "Business Owner",
            phone: null,
            business_name: "Barrio Shop",
            role: "business",
            is_internal: true,
            city: "Los Angeles",
            created_at: "2026-04-20T00:00:00.000Z",
            admin_role_keys: [],
            total_count: 1,
          },
        ],
        error: null,
      });
    }),
  };
}

function createClientForMixedServiceQuery() {
  const usersRows = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      public_id: "biz-111",
      email: "biz@example.com",
      full_name: "Business Owner",
      phone: null,
      business_name: "Barrio Shop",
      role: "business",
      is_internal: false,
      city: "Los Angeles",
      created_at: "2026-04-20T00:00:00.000Z",
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      public_id: "usr-222",
      email: "customer@example.com",
      full_name: "Customer User",
      phone: null,
      business_name: null,
      role: "customer",
      is_internal: false,
      city: "Los Angeles",
      created_at: "2026-04-19T00:00:00.000Z",
    },
  ];

  return {
    from: vi.fn((table: string) => {
      if (table === "admin_role_members") {
        return {
          select: getAdminRoleMembersSelectMock.mockReturnValue({
            data: [],
            error: null,
          }),
        };
      }

      if (table === "users") {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              range: vi.fn().mockResolvedValue({
                data: usersRows,
                count: usersRows.length,
                error: null,
              }),
            })),
          })),
        };
      }

      if (table === "businesses") {
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  owner_user_id: "11111111-1111-4111-8111-111111111111",
                  is_internal: true,
                },
              ],
              error: null,
            }),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("fetchAdminUsers internal semantics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses admin_list_accounts for business lists so business internal status comes from businesses.is_internal", async () => {
    const client = createClientForBusinessRpc();

    const result = await fetchAdminUsers({
      client,
      usingServiceRole: true,
      role: "business",
      includeInternal: true,
      from: 0,
      to: 9,
    });

    expect(client.rpc).toHaveBeenCalledWith(
      "admin_list_accounts",
      expect.objectContaining({
        p_role: "business",
        p_internal: true,
      })
    );
    expect(result.rows[0]?.is_internal).toBe(true);
    expect(result.rows[0]?.account_role).toBe("business");
  });

  it("overrides business row display state with businesses.is_internal on mixed service-role account lists", async () => {
    const client = createClientForMixedServiceQuery();

    const result = await fetchAdminUsers({
      client,
      usingServiceRole: true,
      role: "all",
      from: 0,
      to: 9,
    });

    expect(result.rows.find((row) => row.id === "11111111-1111-4111-8111-111111111111")?.is_internal).toBe(
      true
    );
    expect(result.rows.find((row) => row.id === "22222222-2222-4222-8222-222222222222")?.is_internal).toBe(
      false
    );
  });
});
