import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20260519170000_monetization_foundation.sql"),
  "utf8"
);

describe("monetization foundation migration", () => {
  it("creates the core monetization tables and seeds founding plan defaults", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.monetization_plans");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.business_subscriptions");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.business_feature_usage");
    expect(migration).toContain("'founding_business'");
    expect(migration).toContain("'inventory.online_stock'");
    expect(migration).toContain("'featured_placement.monthly_credits'");
  });

  it("backfills existing businesses and assigns defaults to newly inserted businesses", () => {
    expect(migration).toContain("INSERT INTO public.business_subscriptions");
    expect(migration).toContain("FROM public.businesses b");
    expect(migration).toContain("CREATE TRIGGER businesses_assign_default_subscription");
  });

  it("enforces active listing limits at the database boundary", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.enforce_business_active_listing_limit()");
    expect(migration).toContain("BEFORE INSERT OR UPDATE OF status, admin_hidden, deleted_at ON public.listings");
    expect(migration).toContain("'Active listing limit reached for this business.'");
  });

  it("documents the legacy listings.business_id owner-user mapping", () => {
    expect(migration).toContain("listings.business_id stores the");
    expect(migration).toContain("businesses.owner_user_id");
    expect(migration).toContain("WHERE owner_user_id = NEW.business_id");
  });

  it("restricts direct plan entitlement reads to public, owned, or admin-visible plans", () => {
    expect(migration).toContain("p.is_public = true");
    expect(migration).toContain("b.owner_user_id = auth.uid()");
    expect(migration).toContain("OR public.is_admin()");
  });
});
