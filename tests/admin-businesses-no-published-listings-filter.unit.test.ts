import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchAdminUsers } from "@/lib/admin/users";

function createClient() {
  const users = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      public_id: "usr-real-missing",
      email: "missing@example.com",
      full_name: "Missing Listings Owner",
      phone: null,
      business_name: "Missing Listings Shop",
      role: "business",
      is_internal: false,
      city: "Long Beach",
      created_at: "2026-05-02T00:00:00.000Z",
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      public_id: "usr-real-ready",
      email: "ready@example.com",
      full_name: "Ready Owner",
      phone: null,
      business_name: "Ready Shop",
      role: "business",
      is_internal: false,
      city: "Long Beach",
      created_at: "2026-05-01T00:00:00.000Z",
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      public_id: "usr-demo-only",
      email: "demo-only@example.com",
      full_name: "Demo Only Owner",
      phone: null,
      business_name: "Demo Only Shop",
      role: "business",
      is_internal: false,
      city: "Long Beach",
      created_at: "2026-05-03T00:00:00.000Z",
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      public_id: "usr-internal",
      email: "internal@example.com",
      full_name: "Internal Owner",
      phone: null,
      business_name: "Internal Shop",
      role: "business",
      is_internal: false,
      city: "Long Beach",
      created_at: "2026-05-04T00:00:00.000Z",
    },
  ];

  return {
    from: vi.fn((table: string) => {
      if (table === "admin_role_members") {
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }

      if (table === "businesses") {
        return {
          select: vi.fn().mockResolvedValue({
            data: [
              {
                owner_user_id: users[0].id,
                public_id: "biz-missing",
                business_name: "Missing Listings Shop",
                is_internal: false,
                is_seeded: false,
                verification_status: "manually_verified",
              },
              {
                owner_user_id: users[1].id,
                public_id: "biz-ready",
                business_name: "Ready Shop",
                is_internal: false,
                is_seeded: false,
                verification_status: "manually_verified",
              },
              {
                owner_user_id: users[2].id,
                public_id: "biz-demo-only",
                business_name: "Demo Only Shop",
                is_internal: false,
                is_seeded: false,
                verification_status: "manually_verified",
              },
              {
                owner_user_id: users[3].id,
                public_id: "biz-internal",
                business_name: "Internal Shop",
                is_internal: true,
                is_seeded: false,
                verification_status: "manually_verified",
              },
            ],
            error: null,
          }),
        };
      }

      if (table === "listings") {
        return {
          select: vi.fn().mockResolvedValue({
            data: [
              {
                business_id: users[1].id,
                status: "published",
                is_seeded: false,
                is_internal: false,
                is_test: false,
                admin_hidden: false,
                deleted_at: null,
              },
              {
                business_id: users[2].id,
                status: "published",
                is_seeded: true,
                is_internal: false,
                is_test: false,
                admin_hidden: false,
                deleted_at: null,
              },
            ],
            error: null,
          }),
        };
      }

      if (table === "users") {
        return {
          select: vi.fn(() => ({
            in: vi.fn((_column: string, ids: string[]) =>
              Promise.resolve({
                data: users.filter((user) => ids.includes(user.id)),
                error: null,
              })
            ),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("businesses no-published-listings admin filter", () => {
  it("returns real businesses with zero published real listings", async () => {
    const result = await fetchAdminUsers({
      client: createClient(),
      usingServiceRole: true,
      role: "business",
      businessInventoryFilter: "no-published-listings",
      from: 0,
      to: 10,
    });

    expect(result.error).toBeUndefined();
    expect(result.count).toBe(2);
    expect(result.rows.map((row) => row.business_name)).toEqual([
      "Demo Only Shop",
      "Missing Listings Shop",
    ]);
  });
});
