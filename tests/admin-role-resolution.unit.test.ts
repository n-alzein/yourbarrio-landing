import { describe, expect, it } from "vitest";
import { normalizeLegacyAdminRole } from "@/lib/admin/roleResolution";

describe("normalizeLegacyAdminRole", () => {
  it("maps legacy super-admin role strings to admin_super", () => {
    expect(normalizeLegacyAdminRole("admin_super")).toBe("admin_super");
    expect(normalizeLegacyAdminRole("super_admin")).toBe("admin_super");
  });
});
