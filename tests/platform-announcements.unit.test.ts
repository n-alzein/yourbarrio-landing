import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveNotices } from "@/lib/notices/resolve-notices";
import {
  eligibleAnnouncementAudiences,
  getActivePlatformAnnouncementForAudience,
  platformAnnouncementToNotice,
} from "@/lib/notices/platform-announcements";
import { platformAnnouncementInputSchema } from "@/lib/admin/platformAnnouncementValidation";

const { getAdminServiceRoleClientMock } = vi.hoisted(() => ({
  getAdminServiceRoleClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminServiceRoleClient: getAdminServiceRoleClientMock,
}));

function announcement(overrides: Record<string, any> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Maintenance",
    message: "YourBarrio may be briefly unavailable tonight.",
    cta_label: null,
    cta_href: null,
    audience: "all",
    variant: "info",
    priority: 50,
    starts_at: null,
    ends_at: null,
    dismissible: true,
    status: "active",
    created_at: "2026-05-06T10:00:00.000Z",
    updated_at: "2026-05-06T10:00:00.000Z",
    ...overrides,
  };
}

function mockAnnouncementRows(rows: any[]) {
  const query: any = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    or: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(async () => ({ data: rows, error: null })),
  };
  getAdminServiceRoleClientMock.mockReturnValue({
    from: vi.fn(() => query),
  });
  return query;
}

describe("platform announcement resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("matches audiences by viewer type", () => {
    expect(eligibleAnnouncementAudiences("guest")).toEqual(["all", "guests"]);
    expect(eligibleAnnouncementAudiences("customer")).toEqual(["all", "customers"]);
    expect(eligibleAnnouncementAudiences("business")).toEqual(["all", "businesses"]);
  });

  it("selects the highest-priority eligible active announcement", async () => {
    mockAnnouncementRows([
      announcement({ id: "11111111-1111-4111-8111-111111111111", priority: 20 }),
      announcement({ id: "22222222-2222-4222-8222-222222222222", priority: 90 }),
    ]);

    const active = await getActivePlatformAnnouncementForAudience("guest");

    expect(active?.id).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("maps edited announcements to a new session dismissal id", () => {
    const first = platformAnnouncementToNotice(announcement({ updated_at: "2026-05-06T10:00:00.000Z" }));
    const second = platformAnnouncementToNotice(announcement({ updated_at: "2026-05-06T11:00:00.000Z" }));

    expect(first.id).not.toBe(second.id);
    expect(second.id).toContain("platform-announcement:");
  });

  it("platform announcements outrank profile completion", () => {
    const notice = resolveNotices({
      user: { id: "user-1" },
      role: "customer",
      profile: { id: "user-1", role: "customer", full_name: "", phone: "" },
      extraNotices: [platformAnnouncementToNotice(announcement({ variant: "info", priority: 1 }))],
    });

    expect(notice?.id).toContain("platform-announcement:");
  });
});

describe("platform announcement validation", () => {
  it("rejects unsafe CTA hrefs", () => {
    const parsed = platformAnnouncementInputSchema.safeParse({
      message: "Issue update",
      audience: "all",
      variant: "info",
      status: "draft",
      cta_label: "More",
      cta_href: "javascript:alert(1)",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects invalid enum values and invalid windows", () => {
    const parsed = platformAnnouncementInputSchema.safeParse({
      message: "Issue update",
      audience: "admins",
      variant: "loud",
      status: "published",
      starts_at: "2026-05-06T12:00:00.000Z",
      ends_at: "2026-05-06T11:00:00.000Z",
    });

    expect(parsed.success).toBe(false);
  });
});
