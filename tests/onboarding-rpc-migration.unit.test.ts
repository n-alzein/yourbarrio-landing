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
});
