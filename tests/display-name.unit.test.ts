import { describe, expect, it } from "vitest";
import { getBusinessDisplayName } from "@/lib/auth/displayName";

describe("getBusinessDisplayName", () => {
  it("prefers businesses.business_name", () => {
    expect(
      getBusinessDisplayName({
        business: { business_name: "Cafe Uno" },
        profile: { business_name: "Profile Biz", full_name: "Owner Name" },
        user: { email: "owner@example.com" },
      })
    ).toBe("Cafe Uno");
  });

  it("falls back to users.business_name, then full_name", () => {
    expect(
      getBusinessDisplayName({
        business: null,
        profile: { business_name: "Profile Biz", full_name: "Owner Name" },
        user: { email: "owner@example.com" },
      })
    ).toBe("Profile Biz");

    expect(
      getBusinessDisplayName({
        business: null,
        profile: { business_name: " ", full_name: "Owner Name" },
        user: { email: "owner@example.com" },
      })
    ).toBe("Owner Name");
  });

  it("falls back to email and then generic label", () => {
    expect(
      getBusinessDisplayName({
        business: null,
        profile: null,
        user: { email: "owner@example.com" },
      })
    ).toBe("owner@example.com");

    expect(
      getBusinessDisplayName({
        business: null,
        profile: null,
        user: null,
      })
    ).toBe("Business");
  });
});
