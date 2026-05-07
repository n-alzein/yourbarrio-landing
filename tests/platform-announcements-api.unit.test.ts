import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdminApiRoleMock, getAdminServiceRoleClientMock } = vi.hoisted(() => ({
  requireAdminApiRoleMock: vi.fn(),
  getAdminServiceRoleClientMock: vi.fn(),
}));

vi.mock("@/lib/admin/requireAdminApiRole", () => ({
  requireAdminApiRole: requireAdminApiRoleMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminServiceRoleClient: getAdminServiceRoleClientMock,
}));

import { POST } from "@/app/api/admin/platform-announcements/route";
import { PATCH } from "@/app/api/admin/platform-announcements/[id]/route";

function okAuth(roles = ["admin_ops"]) {
  requireAdminApiRoleMock.mockResolvedValue({
    ok: true,
    actorUser: { id: "33333333-3333-4333-8333-333333333333", email: "admin@example.com" },
    actorRoleKeys: roles,
  });
}

function mockInsert() {
  const single = vi.fn(async () => ({
    data: {
      id: "11111111-1111-4111-8111-111111111111",
      message: "Maintenance",
      audience: "all",
      variant: "info",
      status: "active",
    },
    error: null,
  }));
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  getAdminServiceRoleClientMock.mockReturnValue({ from: vi.fn(() => ({ insert })) });
  return { insert };
}

function mockUpdate() {
  const single = vi.fn(async () => ({
    data: { id: "11111111-1111-4111-8111-111111111111", status: "archived" },
    error: null,
  }));
  const select = vi.fn(() => ({ single }));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  getAdminServiceRoleClientMock.mockReturnValue({ from: vi.fn(() => ({ update })) });
  return { update };
}

describe("admin platform announcement API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-admin access", async () => {
    requireAdminApiRoleMock.mockResolvedValue({
      ok: false,
      status: 403,
      error: "You don't have permission.",
    });

    const response = await POST(new Request("http://localhost", { method: "POST" }));

    expect(response.status).toBe(403);
    expect(getAdminServiceRoleClientMock).not.toHaveBeenCalled();
  });

  it("allows ops admins to create active announcements", async () => {
    okAuth(["admin_ops"]);
    const { insert } = mockInsert();

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Maintenance",
          audience: "all",
          variant: "critical",
          status: "active",
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Maintenance",
        audience: "all",
        variant: "critical",
        status: "active",
        created_by: "33333333-3333-4333-8333-333333333333",
      })
    );
  });

  it("rejects invalid CTA hrefs", async () => {
    okAuth(["admin_ops"]);

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Maintenance",
          audience: "all",
          variant: "info",
          status: "draft",
          cta_label: "More",
          cta_href: "javascript:alert(1)",
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(getAdminServiceRoleClientMock).not.toHaveBeenCalled();
  });

  it("allows ops admins to archive announcements", async () => {
    okAuth(["admin_ops"]);
    const { update } = mockUpdate();

    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      }),
      { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) }
    );

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "archived",
        updated_by: "33333333-3333-4333-8333-333333333333",
      })
    );
  });
});
