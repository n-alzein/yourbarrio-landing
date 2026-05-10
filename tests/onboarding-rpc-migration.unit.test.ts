import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260510120000_separate_business_phone_and_internal_flags.sql"
  ),
  "utf8"
);
const emailRepairMigration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260510123000_fill_user_email_in_business_onboarding_rpc.sql"
  ),
  "utf8"
);
const backfillMigration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260510124000_backfill_blank_public_user_emails_from_auth.sql"
  ),
  "utf8"
);

describe("business onboarding RPC migration", () => {
  it("updates existing business rows through an explicit public-field allowlist", () => {
    expect(migration).toContain("ON CONFLICT (owner_user_id) DO UPDATE SET");
    expect(migration).toContain("business_name = EXCLUDED.business_name");
    expect(migration).toContain("phone = EXCLUDED.phone");
    expect(migration).toContain("longitude = EXCLUDED.longitude");
    expect(migration).not.toContain("owner_user_id = EXCLUDED.owner_user_id");
  });

  it("keeps account and public business phones independent without internal flag writes", () => {
    expect(migration).toContain("v_account_phone text := NULLIF(trim(COALESCE(p_payload->>'notifications_phone', '')), '')");
    expect(migration).toContain("v_business_phone text := NULLIF(trim(COALESCE(p_payload->>'phone', '')), '')");
    expect(migration).toContain("phone = COALESCE(EXCLUDED.phone, public.users.phone)");
    expect(migration).not.toMatch(/\bis_internal\b/);
  });

  it("fills the public user email from auth while preserving non-empty existing emails", () => {
    expect(emailRepairMigration).toContain("FROM auth.users au");
    expect(emailRepairMigration).toContain("lower(NULLIF(trim(au.email), ''))");
    expect(emailRepairMigration).toContain("email = COALESCE(NULLIF(trim(public.users.email), ''), EXCLUDED.email)");
    expect(emailRepairMigration).not.toContain("p_payload->>'email'");
  });

  it("backfills only active blank public user emails from matching auth users", () => {
    expect(backfillMigration).toContain("NULLIF(trim(u.email), '') IS NULL");
    expect(backfillMigration).toContain("NULLIF(trim(au.email), '') IS NOT NULL");
    expect(backfillMigration).toContain("COALESCE(u.account_status, 'active') <> 'deleted'");
    expect(backfillMigration).toContain("u.deleted_at IS NULL");
    expect(backfillMigration).toContain("u.anonymized_at IS NULL");
    expect(backfillMigration).toContain("email = lower(trim(au.email))");
  });
});
