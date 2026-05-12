import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminApiRoleMock,
  getAdminServiceRoleClientMock,
  rpcMock,
  storageRemoveMock,
  deleteUserMock,
} = vi.hoisted(() => ({
  requireAdminApiRoleMock: vi.fn(),
  getAdminServiceRoleClientMock: vi.fn(),
  rpcMock: vi.fn(),
  storageRemoveMock: vi.fn(),
  deleteUserMock: vi.fn(),
}));

vi.mock("@/lib/admin/requireAdminApiRole", () => ({
  requireAdminApiRole: requireAdminApiRoleMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminServiceRoleClient: getAdminServiceRoleClientMock,
}));

import { GET, POST } from "@/app/api/admin/users/[id]/hard-delete/route";

const TARGET_USER_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_USER_ID = "22222222-2222-4222-8222-222222222222";

function createRequest(body: Record<string, unknown>) {
  return new Request(`http://localhost:3000/api/admin/users/${TARGET_USER_ID}/hard-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createContext(id = TARGET_USER_ID) {
  return { params: Promise.resolve({ id }) };
}

function createAdminClient() {
  return {
    rpc: rpcMock,
    storage: {
      from: vi.fn(() => ({
        remove: storageRemoveMock,
      })),
    },
    auth: {
      admin: {
        deleteUser: deleteUserMock,
      },
    },
  };
}

function eligiblePreview(overrides: Record<string, unknown> = {}) {
  return {
    eligible: true,
    blocked: false,
    block_reason: null,
    counts: {
      user_profile: 1,
      auth_account: 1,
      businesses: 1,
      listings: 2,
      storage_files: 1,
    },
    storage_objects: [{ bucket: "business-photos", path: "tmp/test-user/source.webp" }],
    warnings: [],
    ...overrides,
  };
}

describe("admin fake/test user hard delete route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    delete process.env.ALLOW_PRELAUNCH_HARD_DELETE;
    requireAdminApiRoleMock.mockResolvedValue({
      ok: true,
      actorUser: { id: ACTOR_USER_ID, email: "super@example.com" },
      actorRoleKeys: ["admin_super"],
    });
    getAdminServiceRoleClientMock.mockReturnValue(createAdminClient());
    storageRemoveMock.mockResolvedValue({ data: [], error: null });
    deleteUserMock.mockResolvedValue({ error: null });
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === "admin_preview_hard_delete_test_user") {
        return { data: eligiblePreview(), error: null };
      }
      if (fn === "admin_hard_delete_test_user") {
        return { data: eligiblePreview(), error: null };
      }
      if (fn === "log_admin_action") {
        return { data: "audit-id", error: null };
      }
      return { data: null, error: null };
    });
  });

  it("rejects non-admins before preview", async () => {
    requireAdminApiRoleMock.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Unauthorized",
    });

    const response = await GET(new Request("http://localhost"), createContext());

    expect(response.status).toBe(401);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects normal admins before preview", async () => {
    requireAdminApiRoleMock.mockResolvedValue({
      ok: false,
      status: 403,
      error: "You don't have permission.",
    });

    const response = await POST(createRequest({ mode: "dry_run" }), createContext());

    expect(response.status).toBe(403);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("allows super admins to dry-run eligible fake/test users", async () => {
    const response = await POST(createRequest({ mode: "dry_run" }), createContext());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.mode).toBe("dry_run");
    expect(payload.preview.counts.listings).toBe(2);
    expect(rpcMock).toHaveBeenCalledWith("admin_preview_hard_delete_test_user", {
      p_target_user_id: TARGET_USER_ID,
    });
  });

  it("requires exact confirmation text for execute", async () => {
    const response = await POST(
      createRequest({ mode: "execute", confirmation: "delete" }),
      createContext()
    );

    expect(response.status).toBe(400);
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it("blocks non-test users returned by the cleanup preview", async () => {
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === "admin_preview_hard_delete_test_user") {
        return {
          data: eligiblePreview({
            eligible: false,
            blocked: true,
            block_reason:
              "This user is not marked as fake, test, or internal. Use the normal account deletion/anonymization flow instead.",
          }),
          error: null,
        };
      }
      return { data: "audit-id", error: null };
    });

    const response = await POST(createRequest({ mode: "dry_run" }), createContext());
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toContain("not marked as fake");
  });

  it("blocks users with real commerce records", async () => {
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === "admin_preview_hard_delete_test_user") {
        return {
          data: eligiblePreview({
            eligible: true,
            blocked: true,
            block_reason: "This user has real commerce records and cannot be hard deleted.",
          }),
          error: null,
        };
      }
      return { data: "audit-id", error: null };
    });

    const response = await POST(createRequest({ mode: "dry_run" }), createContext());
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toContain("real commerce");
  });

  it("runs database cleanup, storage cleanup, then auth deletion on execute", async () => {
    const calls: string[] = [];
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === "admin_preview_hard_delete_test_user") {
        calls.push("preview");
        return { data: eligiblePreview(), error: null };
      }
      if (fn === "admin_hard_delete_test_user") {
        calls.push("db_cleanup");
        return { data: eligiblePreview(), error: null };
      }
      calls.push(`audit:${fn}`);
      return { data: "audit-id", error: null };
    });
    storageRemoveMock.mockImplementation(async () => {
      calls.push("storage");
      return { data: [], error: null };
    });
    deleteUserMock.mockImplementation(async () => {
      calls.push("auth_delete");
      return { error: null };
    });

    const response = await POST(
      createRequest({ mode: "execute", confirmation: "HARD DELETE USER" }),
      createContext()
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.message).toBe("Fake/test account permanently deleted.");
    expect(calls.indexOf("db_cleanup")).toBeLessThan(calls.indexOf("storage"));
    expect(calls.indexOf("storage")).toBeLessThan(calls.indexOf("auth_delete"));
    expect(storageRemoveMock).toHaveBeenCalledWith(["tmp/test-user/source.webp"]);
    expect(deleteUserMock).toHaveBeenCalledWith(TARGET_USER_ID, false);
  });

  it("returns storage warnings and logs them when storage deletion partially fails", async () => {
    storageRemoveMock.mockResolvedValue({
      data: [],
      error: { message: "object delete failed" },
    });

    const response = await POST(
      createRequest({ mode: "execute", confirmation: "HARD DELETE USER" }),
      createContext()
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.warnings[0]).toContain("object delete failed");
    expect(rpcMock).toHaveBeenCalledWith(
      "log_admin_action",
      expect.objectContaining({
        p_action: "user_hard_delete_storage_warning",
      })
    );
  });
});
