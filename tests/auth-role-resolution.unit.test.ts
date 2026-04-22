import { describe, expect, it, vi } from "vitest";
import { resolveCurrentUserRoleFromClient } from "@/lib/auth/resolveCurrentUserRoleFromClient";

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "user@example.com",
    app_metadata: {},
    user_metadata: {},
    ...overrides,
  };
}

function makeSupabase({
  user = makeUser(),
  userError = null,
  profile = null,
  profileError = null,
  profileThrows = false,
  adminRows = [],
  adminError = null,
}: {
  user?: any;
  userError?: any;
  profile?: any;
  profileError?: any;
  profileThrows?: boolean;
  adminRows?: any[];
  adminError?: any;
} = {}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: userError,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "users") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: profileThrows
                ? vi.fn().mockRejectedValue(new Error("profile lookup failed"))
                : vi.fn().mockResolvedValue({ data: profile, error: profileError }),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: adminRows, error: adminError }),
        })),
      };
    }),
  };
}

describe("resolveCurrentUserRoleFromClient", () => {
  it("defaults a valid auth user with no profile role to customer", async () => {
    const result = await resolveCurrentUserRoleFromClient(makeSupabase() as any);

    expect(result.user?.id).toBe("user-1");
    expect(result.role).toBe("customer");
  });

  it("does not lose the auth user when profile lookup throws during handoff", async () => {
    const result = await resolveCurrentUserRoleFromClient(
      makeSupabase({ profileThrows: true }) as any
    );

    expect(result.user?.id).toBe("user-1");
    expect(result.role).toBe("customer");
  });

  it("preserves explicit business role from auth metadata", async () => {
    const result = await resolveCurrentUserRoleFromClient(
      makeSupabase({
        user: makeUser({
          app_metadata: { role: "business" },
        }),
      }) as any
    );

    expect(result.role).toBe("business");
  });

  it("resolves admin role before the customer fallback", async () => {
    const result = await resolveCurrentUserRoleFromClient(
      makeSupabase({
        adminRows: [{ role_key: "admin_support" }],
      }) as any
    );

    expect(result.role).toBe("admin");
  });

  it("returns anonymous when Supabase auth has no user", async () => {
    const result = await resolveCurrentUserRoleFromClient(
      makeSupabase({ user: null }) as any
    );

    expect(result.user).toBeNull();
    expect(result.role).toBe("anon");
  });
});
