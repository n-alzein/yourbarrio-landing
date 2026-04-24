import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  redirectMock,
  revalidatePathMock,
  requireAdminMock,
  canAdminMock,
  getAdminDataClientMock,
  auditMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
  revalidatePathMock: vi.fn(),
  requireAdminMock: vi.fn(),
  canAdminMock: vi.fn(),
  getAdminDataClientMock: vi.fn(),
  auditMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/admin/audit", () => ({
  audit: auditMock,
}));

vi.mock("@/lib/admin/supportMode", () => ({
  clearSupportModeCookies: vi.fn(),
  getEffectiveActorAndTarget: vi.fn(),
  readSupportModeCookies: vi.fn(),
  validateSupportModeSession: vi.fn(),
  IMPERSONATE_SESSION_COOKIE: "impersonate_session",
  IMPERSONATE_TARGET_ROLE_COOKIE: "impersonate_target_role",
  IMPERSONATE_USER_COOKIE: "impersonate_user",
}));

vi.mock("@/lib/auth/clearAuthCookies", () => ({
  clearAllAuthCookies: vi.fn(),
}));

vi.mock("@/lib/auth/getSiteUrl", () => ({
  getSiteUrlFromHeaders: vi.fn(),
}));

vi.mock("@/lib/auth/redirects", () => ({
  getSafeRedirectPath: (path: string) => path,
}));

vi.mock("@/lib/admin/permissions", () => ({
  ADMIN_ROLES: [],
  canAdmin: canAdminMock,
  requireAdmin: requireAdminMock,
  requireAdminAnyRole: vi.fn(),
  requireAdminRole: vi.fn(),
}));

vi.mock("@/lib/http/cookiesSecurity", () => ({
  shouldUseSecureCookies: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({
  getSupabaseServerAuthedClient: vi.fn(),
  getSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminDataClient: getAdminDataClientMock,
  getAdminServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/email/adminInvite", () => ({
  sendAdminInvite: vi.fn(),
}));

vi.mock("@/lib/featureFlags", () => ({
  setFeatureFlag: vi.fn(),
}));

vi.mock("@/lib/taxonomy/compat", () => ({
  buildBusinessTaxonomyPayload: vi.fn(),
}));

import { toggleBusinessInternalAction } from "@/app/admin/actions";

function createAdminClient({
  existingBusinessInternal = false,
}: {
  existingBusinessInternal?: boolean;
} = {}) {
  const usersPublicIdMaybeSingle = vi.fn().mockResolvedValue({
    data: { public_id: "biz-public-1" },
    error: null,
  });
  const businessesMaybeSingle = vi.fn().mockResolvedValue({
    data: {
      owner_user_id: "11111111-1111-4111-8111-111111111111",
      is_internal: existingBusinessInternal,
    },
    error: null,
  });
  const usersUpdateEq = vi.fn().mockResolvedValue({ error: null });
  const businessesUpdateEq = vi.fn().mockResolvedValue({ error: null });

  const client = {
    from: vi.fn((table: string) => {
      if (table === "users") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: usersPublicIdMaybeSingle })),
          })),
          update: vi.fn((payload) => ({
            eq: vi.fn((field: string, value: string) => {
              usersUpdateEq(payload, field, value);
              return Promise.resolve({ error: null });
            }),
          })),
        };
      }
      if (table === "businesses") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: businessesMaybeSingle })),
          })),
          update: vi.fn((payload) => ({
            eq: vi.fn((field: string, value: string) => {
              businessesUpdateEq(payload, field, value);
              return Promise.resolve({ error: null });
            }),
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return {
    client,
    usersUpdateEq,
    businessesUpdateEq,
  };
}

describe("toggleBusinessInternalAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({
      user: { id: "admin-user-1" },
      roles: ["admin_ops"],
      strictPermissionBypassUsed: false,
    });
    canAdminMock.mockReturnValue(true);
  });

  it("grants owner internal tester access when enabling an internal/test business", async () => {
    const adminClient = createAdminClient({ existingBusinessInternal: false });
    getAdminDataClientMock.mockResolvedValue({ client: adminClient.client });

    const formData = new FormData();
    formData.set("userId", "11111111-1111-4111-8111-111111111111");
    formData.set("isInternal", "true");

    await expect(toggleBusinessInternalAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/admin/users/biz-public-1?success=Internal%2Ftest+business+updated"
    );

    expect(adminClient.usersUpdateEq).toHaveBeenCalledWith(
      expect.objectContaining({ is_internal: true }),
      "id",
      "11111111-1111-4111-8111-111111111111"
    );
    expect(adminClient.businessesUpdateEq).toHaveBeenCalledWith(
      expect.objectContaining({ is_internal: true }),
      "owner_user_id",
      "11111111-1111-4111-8111-111111111111"
    );
  });

  it("does not revoke owner internal tester access when disabling an internal/test business", async () => {
    const adminClient = createAdminClient({ existingBusinessInternal: true });
    getAdminDataClientMock.mockResolvedValue({ client: adminClient.client });

    const formData = new FormData();
    formData.set("userId", "11111111-1111-4111-8111-111111111111");
    formData.set("isInternal", "false");

    await expect(toggleBusinessInternalAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/admin/users/biz-public-1?success=Internal%2Ftest+business+updated"
    );

    expect(adminClient.usersUpdateEq).not.toHaveBeenCalled();
    expect(adminClient.businessesUpdateEq).toHaveBeenCalledWith(
      expect.objectContaining({ is_internal: false }),
      "owner_user_id",
      "11111111-1111-4111-8111-111111111111"
    );
  });
});
