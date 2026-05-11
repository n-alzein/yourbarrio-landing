import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAdminDataClientMock,
  redirectMock,
  requireAdminAnyRoleMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  getAdminDataClientMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    const error = new Error("NEXT_REDIRECT") as Error & { digest?: string };
    error.digest = `NEXT_REDIRECT;replace;${url}`;
    throw error;
  }),
  requireAdminAnyRoleMock: vi.fn(),
  revalidatePathMock: vi.fn(),
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

vi.mock("@/lib/admin/permissions", () => ({
  ADMIN_ROLES: ["admin_readonly", "admin_support", "admin_ops", "admin_super"],
  canAdmin: vi.fn(() => true),
  requireAdmin: vi.fn(),
  requireAdminAnyRole: requireAdminAnyRoleMock,
  requireAdminRole: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminDataClient: getAdminDataClientMock,
  getAdminServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/admin/audit", () => ({
  audit: vi.fn(),
}));

vi.mock("@/lib/admin/supportMode", () => ({
  IMPERSONATE_SESSION_COOKIE: "impersonate_session",
  IMPERSONATE_TARGET_ROLE_COOKIE: "impersonate_target_role",
  IMPERSONATE_USER_COOKIE: "impersonate_user",
  clearSupportModeCookies: vi.fn(),
  getEffectiveActorAndTarget: vi.fn(),
  readSupportModeCookies: vi.fn(),
  validateSupportModeSession: vi.fn(),
}));

vi.mock("@/lib/auth/clearAuthCookies", () => ({
  clearAllAuthCookies: vi.fn(),
}));

vi.mock("@/lib/auth/getSiteUrl", () => ({
  getSiteUrlFromHeaders: vi.fn(() => "http://localhost:3000"),
}));

vi.mock("@/lib/email/adminInvite", () => ({
  sendAdminInvite: vi.fn(),
}));

vi.mock("@/lib/featureFlags", () => ({
  setFeatureFlag: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({
  getSupabaseServerAuthedClient: vi.fn(),
  getSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/taxonomy/compat", () => ({
  buildBusinessTaxonomyPayload: vi.fn(() => ({})),
}));

import {
  hideListingAndResolveModerationFlagAction,
  hideReviewAndResolveModerationFlagAction,
  takeModerationCaseAction,
  updateModerationFlagAction,
} from "@/app/admin/actions";

const flagId = "11111111-1111-4111-8111-111111111111";
const targetId = "33333333-3333-4333-8333-333333333333";

function redirectUrl() {
  const call = redirectMock.mock.calls.at(-1);
  return call?.[0] ? String(call[0]) : "";
}

function redirectErrorMessage() {
  return new URL(redirectUrl(), "http://localhost").searchParams.get("error") || "";
}

async function expectRedirect(promise: Promise<unknown>) {
  await expect(promise).rejects.toMatchObject({
    digest: expect.stringContaining("NEXT_REDIRECT"),
  });
}

describe("admin moderation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminAnyRoleMock.mockResolvedValue({
      user: { id: "22222222-2222-4222-8222-222222222222" },
      roles: ["admin_ops"],
    });
  });

  it("updates moderation status through the audited moderation RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    getAdminDataClientMock.mockResolvedValue({ client: { rpc } });
    const formData = new FormData();
    formData.set("id", flagId);
    formData.set("status", "resolved");
    formData.set("returnTo", "/admin/moderation?status=open");

    await expectRedirect(updateModerationFlagAction(formData));

    expect(rpc).toHaveBeenCalledWith("admin_update_moderation_flag", {
      p_flag_id: flagId,
      p_status: "resolved",
      p_admin_notes: null,
      p_meta: { action: "status_change" },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/moderation");
    expect(redirectUrl()).toContain("ok=updated");
  });

  it("dismisses moderation flags through the same audited update RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    getAdminDataClientMock.mockResolvedValue({ client: { rpc } });
    const formData = new FormData();
    formData.set("id", flagId);
    formData.set("status", "dismissed");
    formData.set("adminNotes", "Not a policy violation");

    await expectRedirect(updateModerationFlagAction(formData));

    expect(rpc).toHaveBeenCalledWith("admin_update_moderation_flag", {
      p_flag_id: flagId,
      p_status: "dismissed",
      p_admin_notes: "Not a policy violation",
      p_meta: { action: "status_change" },
    });
    expect(redirectUrl()).toContain("ok=updated");
  });

  it("takes a case through admin_take_moderation_case and falls back to the audited update RPC", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { message: "function public.admin_take_moderation_case(uuid) does not exist" },
      })
      .mockResolvedValueOnce({ data: null, error: null });
    getAdminDataClientMock.mockResolvedValue({ client: { rpc } });
    const formData = new FormData();
    formData.set("id", flagId);

    await expectRedirect(takeModerationCaseAction(formData));

    expect(rpc).toHaveBeenNthCalledWith(1, "admin_take_moderation_case", {
      p_flag_id: flagId,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "admin_update_moderation_flag", {
      p_flag_id: flagId,
      p_status: "in_review",
      p_admin_notes: null,
      p_meta: { action: "take_case" },
    });
    expect(redirectUrl()).toContain("ok=case_taken");
  });

  it("routes listing hide-and-resolve through the audited moderation RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    getAdminDataClientMock.mockResolvedValue({ client: { rpc } });
    const formData = new FormData();
    formData.set("id", flagId);
    formData.set("targetId", targetId);
    formData.set("adminNotes", "Confirmed listing issue");

    await expectRedirect(hideListingAndResolveModerationFlagAction(formData));

    expect(rpc).toHaveBeenCalledWith("admin_hide_listing_and_resolve_flag", {
      p_flag_id: flagId,
      p_listing_id: targetId,
      p_notes: "Confirmed listing issue",
    });
    expect(redirectUrl()).toContain("ok=hidden_and_resolved");
  });

  it("routes review hide-and-resolve through the audited moderation RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    getAdminDataClientMock.mockResolvedValue({ client: { rpc } });
    const formData = new FormData();
    formData.set("id", flagId);
    formData.set("targetId", targetId);

    await expectRedirect(hideReviewAndResolveModerationFlagAction(formData));

    expect(rpc).toHaveBeenCalledWith("admin_hide_review_and_resolve_flag", {
      p_flag_id: flagId,
      p_review_id: targetId,
      p_notes: null,
    });
    expect(redirectUrl()).toContain("ok=hidden_and_resolved");
  });

  it("does not expose raw Postgres audit signature errors to admins", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: "function public.log_admin_action(unknown, unknown, text, jsonb, uuid) does not exist",
      },
    });
    getAdminDataClientMock.mockResolvedValue({ client: { rpc } });
    const formData = new FormData();
    formData.set("id", flagId);
    formData.set("status", "dismissed");

    await expectRedirect(updateModerationFlagAction(formData));

    expect(redirectErrorMessage()).toBe("Could not update this moderation case. Please try again.");
    expect(redirectErrorMessage()).not.toContain("log_admin_action");
  });
});
