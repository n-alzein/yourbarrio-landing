import { describe, expect, it } from "vitest";
import { isBusinessOnboardingComplete } from "@/lib/business/onboardingCompletion";

describe("isBusinessOnboardingComplete", () => {
  it("returns false when row is missing", () => {
    expect(isBusinessOnboardingComplete(null)).toBe(false);
  });

  it("returns false when required onboarding fields are missing", () => {
    expect(
      isBusinessOnboardingComplete({
        business_name: "Cafe Uno",
        category: "Cafe",
        address: "",
        city: "Long Beach",
        state: "CA",
        postal_code: "90802",
      })
    ).toBe(false);
  });

  it("returns true when required onboarding fields are present", () => {
    expect(
      isBusinessOnboardingComplete({
        business_name: "Cafe Uno",
        category: "Cafe",
        address: "123 Main St",
        city: "Long Beach",
        state: "CA",
        postal_code: "90802",
      })
    ).toBe(true);
  });
});

