import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260511120000_fix_moderation_audit_log_signature.sql"
);

describe("moderation audit signature migration", () => {
  it("rebuilds moderation audit calls with canonical positional audit arguments", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.admin_update_moderation_flag");
    expect(sql).toMatch(
      /PERFORM public\.log_admin_action\(\s*'moderation_flag_update',\s*v_actor_id,\s*'moderation_flag',\s*p_flag_id::text,\s*jsonb_build_object\(/m
    );
    expect(sql).toMatch(
      /PERFORM public\.log_admin_action\(\s*'moderation_hide_listing',\s*v_actor_id,\s*'listing',\s*p_listing_id::text,\s*jsonb_build_object\(/m
    );
    expect(sql).toMatch(
      /PERFORM public\.log_admin_action\(\s*'moderation_hide_review',\s*v_actor_id,\s*'review',\s*p_review_id::text,\s*jsonb_build_object\(/m
    );
  });

  it("does not depend on named p_* audit arguments or the old positional order", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).not.toContain("p_action => 'moderation_flag_update'");
    expect(sql).not.toContain("p_actor_user_id => v_actor_id");
    expect(sql).not.toContain("p_target_type => 'moderation_flag'");
    expect(sql).not.toContain("p_target_id => p_flag_id::text");
    expect(sql).not.toMatch(
      /public\.log_admin_action\(\s*'moderation_flag_update'\s*,\s*'moderation_flag'\s*,\s*p_flag_id::text\s*,/m
    );
    expect(sql).not.toMatch(
      /public\.log_admin_action\(\s*'moderation_hide_(listing|review)'\s*,\s*'(listing|review)'\s*,/m
    );
  });

  it("bootstraps the canonical text-target signature only when it is missing", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("IF NOT EXISTS");
    expect(sql).toContain("pg_catalog.oidvectortypes(p.proargtypes) = 'text, uuid, text, text, jsonb'");
    expect(sql).toContain("CREATE FUNCTION public.log_admin_action");
    expect(sql).toContain("action text");
    expect(sql).toContain("actor_user_id uuid");
    expect(sql).toContain("target_type text");
    expect(sql).toContain("target_id text");
    expect(sql).toContain("meta jsonb");
  });
});
