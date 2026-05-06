import { describe, expect, it } from "vitest";
import { getCustomerProfileCompletion } from "@/lib/customer/profile-completion";

describe("getCustomerProfileCompletion", () => {
  it("marks empty customer profile fields as incomplete", () => {
    const completion = getCustomerProfileCompletion({
      full_name: " ",
      phone: "562",
      address: "123 Main St",
      city: "",
      state: "CA",
      postal_code: "90802",
    });

    expect(completion).toMatchObject({
      hasFullName: false,
      hasPhone: false,
      hasAddress: false,
      completedCount: 0,
      completionPercent: 0,
      nextRecommendedAction: "full_name",
    });
    expect(completion.missingFields).toEqual(["full_name", "phone", "address"]);
  });

  it("accepts complete name, valid US phone, and checkout-ready address", () => {
    const completion = getCustomerProfileCompletion({
      full_name: "Nour Customer",
      phone: "(562) 123-4567",
      address: "123 Main St",
      address_2: "",
      city: "Long Beach",
      state: "ca",
      postal_code: "90802",
    });

    expect(completion).toMatchObject({
      hasFullName: true,
      hasPhone: true,
      hasAddress: true,
      completedCount: 3,
      completionPercent: 100,
      nextRecommendedAction: null,
    });
    expect(completion.missingFields).toEqual([]);
  });

  it("does not require apartment or suite for address completion", () => {
    expect(
      getCustomerProfileCompletion({
        address: "123 Main St",
        city: "Long Beach",
        state: "CA",
        postal_code: "90802",
      }).hasAddress
    ).toBe(true);
  });

  it("does not count state alone as a complete address", () => {
    const completion = getCustomerProfileCompletion({
      state: "CA",
    });

    expect(completion.hasAddress).toBe(false);
    expect(completion.missingFields).toContain("address");
  });

  it("keeps next missing field priority as name, then phone, then address", () => {
    expect(
      getCustomerProfileCompletion({
        full_name: "",
        phone: "",
      }).nextRecommendedAction
    ).toBe("full_name");

    expect(
      getCustomerProfileCompletion({
        full_name: "Nour Customer",
        phone: "",
      }).nextRecommendedAction
    ).toBe("phone");

    expect(
      getCustomerProfileCompletion({
        full_name: "Nour Customer",
        phone: "(562) 123-4567",
      }).nextRecommendedAction
    ).toBe("address");
  });
});
