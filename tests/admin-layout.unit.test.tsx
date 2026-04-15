import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  requireAdminMock,
  getRequestPathMock,
  getEffectiveUserIdMock,
  getCachedPendingBusinessVerificationsCountMock,
  isAdminDevAllowlistConfiguredMock,
  isAdminBypassRlsEnabledMock,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  getRequestPathMock: vi.fn(),
  getEffectiveUserIdMock: vi.fn(),
  getCachedPendingBusinessVerificationsCountMock: vi.fn(),
  isAdminDevAllowlistConfiguredMock: vi.fn(),
  isAdminBypassRlsEnabledMock: vi.fn(),
}));

vi.mock("@/lib/admin/permissions", () => ({
  requireAdmin: requireAdminMock,
  getHighestAdminRole: (roles: string[]) => roles[0] || null,
  isAdminDevAllowlistConfigured: isAdminDevAllowlistConfiguredMock,
}));

vi.mock("@/lib/url/getRequestPath", () => ({
  getRequestPath: getRequestPathMock,
}));

vi.mock("@/lib/admin/impersonation", () => ({
  getEffectiveUserId: getEffectiveUserIdMock,
}));

vi.mock("@/lib/admin/businessVerification", () => ({
  getCachedPendingBusinessVerificationsCount: getCachedPendingBusinessVerificationsCountMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  isAdminBypassRlsEnabled: isAdminBypassRlsEnabledMock,
}));

vi.mock("@/app/admin/_components/AdminShellClient", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="admin-shell">{children}</div>,
}));

vi.mock("@/app/admin/_components/AdminSidebar", () => ({
  __esModule: true,
  default: () => <div data-testid="admin-sidebar" />,
}));

vi.mock("@/app/admin/_components/AdminStatusStack", () => ({
  __esModule: true,
  default: () => <div data-testid="admin-status" />,
}));

import AdminLayout from "@/app/admin/layout";

describe("AdminLayout", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    getRequestPathMock.mockReset();
    getEffectiveUserIdMock.mockReset();
    getCachedPendingBusinessVerificationsCountMock.mockReset();
    isAdminDevAllowlistConfiguredMock.mockReset();
    isAdminBypassRlsEnabledMock.mockReset();

    getRequestPathMock.mockResolvedValue("/admin/accounts");
    requireAdminMock.mockResolvedValue({
      user: { id: "user-1", email: "admin@example.com" },
      profile: { role: "admin" },
      roles: ["admin_readonly"],
      devAllowlistUsed: false,
      strictPermissionBypassUsed: false,
    });
    getEffectiveUserIdMock.mockResolvedValue({ activeImpersonation: null });
    getCachedPendingBusinessVerificationsCountMock.mockResolvedValue(0);
    isAdminDevAllowlistConfiguredMock.mockReturnValue(false);
    isAdminBypassRlsEnabledMock.mockReturnValue(false);
  });

  it("uses requireAdmin as the authoritative server guard for the admin layout", async () => {
    const result = await AdminLayout({
      children: <div>Accounts</div>,
    });

    expect(result).toBeTruthy();
    expect(getRequestPathMock).toHaveBeenCalledWith("/admin");
    expect(requireAdminMock).toHaveBeenCalledTimes(1);
    expect(requireAdminMock).toHaveBeenCalledWith({
      unauthenticatedRedirectTo: "/login?next=%2Fadmin%2Faccounts",
      unauthorizedRedirectTo: "/not-authorized",
    });
  });
});
