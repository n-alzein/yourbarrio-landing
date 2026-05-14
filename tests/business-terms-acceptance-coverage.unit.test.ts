import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const onboardingPageSource = readFileSync(
  path.join(process.cwd(), "app/onboarding/page.js"),
  "utf8"
);
const onboardingClientSource = readFileSync(
  path.join(process.cwd(), "app/(onboarding)/onboarding/OnboardingClient.jsx"),
  "utf8"
);
const businessesRouteSource = readFileSync(
  path.join(process.cwd(), "app/api/businesses/route.js"),
  "utf8"
);
const businessProfileRouteSource = readFileSync(
  path.join(process.cwd(), "app/api/business/profile/route.js"),
  "utf8"
);
const adminVerificationSource = readFileSync(
  path.join(process.cwd(), "lib/admin/businessVerification.ts"),
  "utf8"
);
const acceptanceMigrationSource = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260514110000_add_business_terms_acceptance_metadata.sql"
  ),
  "utf8"
);

describe("business terms acceptance coverage", () => {
  it("keeps acceptance scoped to final onboarding submission", () => {
    expect(onboardingClientSource).toContain("Before you continue");
    expect(onboardingClientSource).toContain("business_terms_accepted:");
    expect(onboardingClientSource).toContain("initialBusinessTermsAccepted");
    expect(onboardingPageSource).toContain("business_terms_accepted_at");
    expect(onboardingPageSource).toContain("initialBusinessTermsAccepted={Boolean");
  });

  it("does not block ordinary business profile/settings updates with acceptance validation", () => {
    expect(businessProfileRouteSource).not.toContain("business_terms_accepted");
    expect(businessProfileRouteSource).not.toContain(
      "You need to confirm authorization and accept the required policies before continuing."
    );
  });

  it("requires acceptance before onboarding save or verification can proceed", () => {
    expect(businessesRouteSource).toContain("business_terms_accepted !== true");
    expect(businessesRouteSource).toContain('business_terms_version = "May 2026"');
    expect(adminVerificationSource).toContain(
      "Business Terms acceptance is required before this business can be verified."
    );
    expect(adminVerificationSource).toContain("business_terms_accepted_at");
    expect(adminVerificationSource).toContain("business_terms_accepted_by_user_id");
  });

  it("adds database-level verification guard without forcing a global NOT NULL backfill", () => {
    expect(acceptanceMigrationSource).toContain(
      "CREATE OR REPLACE FUNCTION public.enforce_business_terms_acceptance_for_verification"
    );
    expect(acceptanceMigrationSource).toContain(
      "BEFORE INSERT OR UPDATE OF verification_status ON public.businesses"
    );
    expect(acceptanceMigrationSource).toContain(
      "NEW.verification_status IN ('auto_verified', 'manually_verified')"
    );
    expect(acceptanceMigrationSource).not.toContain(
      "ALTER COLUMN business_terms_accepted_at SET NOT NULL"
    );
  });
});
