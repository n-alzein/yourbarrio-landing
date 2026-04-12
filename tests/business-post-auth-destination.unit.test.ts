import { describe, expect, it } from "vitest";
import {
  BUSINESS_CREATE_PASSWORD_PATH,
  BUSINESS_DASHBOARD_PATH,
  BUSINESS_GO_DASHBOARD_PATH,
  BUSINESS_ONBOARDING_PATH,
  getBusinessRedirectDestination,
  isBusinessIntentPath,
  resolvePostAuthDestination,
} from "@/lib/auth/businessPasswordGate";

describe("business post-auth destination", () => {
  it("normalizes deprecated onboarding paths", () => {
    expect(isBusinessIntentPath("/business/onboarding")).toBe(true);
    expect(
      getBusinessRedirectDestination({
        passwordSet: true,
        onboardingComplete: true,
        safeNext: "/business/onboarding",
      })
    ).toBe(BUSINESS_ONBOARDING_PATH);
  });

  it("rejects transient auth routes as final business destinations", () => {
    expect(isBusinessIntentPath("/business-auth/post-confirm")).toBe(false);
    expect(
      getBusinessRedirectDestination({
        passwordSet: true,
        onboardingComplete: true,
        safeNext: "/business-auth/post-confirm",
      })
    ).toBe(BUSINESS_DASHBOARD_PATH);
  });

  it("uses the canonical business route when no safe next path is allowed", () => {
    expect(
      resolvePostAuthDestination({
        role: "business",
        hasSession: true,
        hasUser: true,
        passwordSet: true,
        onboardingComplete: true,
        safeNext: "/business",
      })
    ).toBe(BUSINESS_GO_DASHBOARD_PATH);
  });

  it("keeps password setup and onboarding gating ahead of next destinations", () => {
    expect(
      resolvePostAuthDestination({
        role: "business",
        hasSession: true,
        hasUser: true,
        passwordSet: false,
        onboardingComplete: false,
        safeNext: BUSINESS_GO_DASHBOARD_PATH,
      })
    ).toBe(BUSINESS_CREATE_PASSWORD_PATH);

    expect(
      resolvePostAuthDestination({
        role: "business",
        hasSession: true,
        hasUser: true,
        passwordSet: true,
        onboardingComplete: false,
        safeNext: BUSINESS_GO_DASHBOARD_PATH,
      })
    ).toBe(BUSINESS_ONBOARDING_PATH);
  });

  it("returns non-business users to a safe next path when present", () => {
    expect(
      resolvePostAuthDestination({
        role: "customer",
        hasSession: true,
        hasUser: true,
        safeNext: "/b/test-store",
      })
    ).toBe("/b/test-store");
  });

  it("rejects unsafe non-business next paths and falls back to role landing", () => {
    expect(
      resolvePostAuthDestination({
        role: "customer",
        hasSession: true,
        hasUser: true,
        safeNext: "https://evil.example",
      })
    ).toBe("/customer/home");
  });
});
