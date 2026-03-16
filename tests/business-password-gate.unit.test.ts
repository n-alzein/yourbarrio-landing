import { describe, expect, it } from "vitest";
import {
  BUSINESS_CREATE_PASSWORD_PATH,
  getBusinessCreatePasswordAccessDecision,
} from "@/lib/auth/businessPasswordGate";

describe("getBusinessCreatePasswordAccessDecision", () => {
  it("redirects unauthenticated users to business login with next", () => {
    expect(
      getBusinessCreatePasswordAccessDecision({
        hasSession: false,
      })
    ).toEqual({
      action: "redirect",
      destination: `/business/login?next=${encodeURIComponent(BUSINESS_CREATE_PASSWORD_PATH)}`,
      reason: "no_session",
    });
  });

  it("renders for authenticated business users without a password", () => {
    expect(
      getBusinessCreatePasswordAccessDecision({
        hasSession: true,
        role: "business",
        passwordSet: false,
        onboardingComplete: false,
      })
    ).toEqual({
      action: "render",
      destination: null,
      reason: "business_password_setup_required",
    });
  });

  it("redirects business users with a password to onboarding when onboarding is incomplete", () => {
    expect(
      getBusinessCreatePasswordAccessDecision({
        hasSession: true,
        role: "business",
        passwordSet: true,
        onboardingComplete: false,
      })
    ).toEqual({
      action: "redirect",
      destination: "/onboarding",
      reason: "password_already_set_onboarding_required",
    });
  });

  it("redirects customer users to their landing page", () => {
    expect(
      getBusinessCreatePasswordAccessDecision({
        hasSession: true,
        role: "customer",
        passwordSet: false,
        onboardingComplete: false,
      })
    ).toEqual({
      action: "redirect",
      destination: "/customer/home",
      reason: "wrong_role_customer",
    });
  });
});
