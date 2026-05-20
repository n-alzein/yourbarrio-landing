import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("monetization API permissions", () => {
  it("lets business owners read monetization status through the read-access guard", () => {
    const route = source("app/api/businesses/[businessId]/monetization/status/route.ts");
    expect(route).toContain("requireBusinessMonetizationReadAccess");
  });

  it("protects admin monetization mutations with the admin-access guard", () => {
    expect(source("app/api/admin/businesses/[id]/monetization/plan/route.ts")).toContain(
      "requireBusinessMonetizationAdminAccess"
    );
    expect(source("app/api/admin/businesses/[id]/monetization/overrides/route.ts")).toContain(
      "requireBusinessMonetizationAdminAccess"
    );
    expect(source("app/api/admin/businesses/[id]/monetization/usage/reset/route.ts")).toContain(
      "requireBusinessMonetizationAdminAccess"
    );
  });

  it("does not grant authenticated users direct access to raw Stripe webhook payloads", () => {
    const migration = source("supabase/migrations/20260519170000_monetization_foundation.sql");
    expect(migration).toContain("ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY");
    expect(migration).not.toContain("GRANT SELECT ON public.stripe_webhook_events TO authenticated");
    expect(migration).not.toContain("CREATE POLICY \"Authenticated users can read stripe webhook events\"");
  });
});
