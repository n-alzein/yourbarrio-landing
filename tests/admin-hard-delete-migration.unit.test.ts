import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260512100000_prelaunch_hard_delete_test_users.sql"
);
const sql = readFileSync(migrationPath, "utf8");

describe("pre-launch hard delete migration hardening", () => {
  it("preserves admin audit rows", () => {
    expect(sql).not.toContain("_admin_hd_delete('admin_audit_log'");
    expect(sql).not.toContain('DELETE FROM public.admin_audit_log');
  });

  it("documents and uses current listing owner-user semantics", () => {
    expect(sql).toContain("listings.business_id stores the business owner user id");
    expect(sql).toContain("v_listing_predicate := format('business_id = %L::uuid'");
    const listingCleanupLines = sql
      .split("\n")
      .filter((line) => line.includes("_if_columns('listings'"));
    expect(listingCleanupLines.join("\n")).not.toContain("business_id::text IN");
  });

  it("blocks conversations with real users and real business owners", () => {
    expect(sql).toContain("conversations.business_id as public.users.id");
    expect(sql).toContain("supports environments where it was migrated to public.businesses.id");
    expect(sql).toContain("JOIN public.users owner_user ON owner_user.id = cb.owner_user_id");
    expect(sql).toContain("This user has conversations with real users and cannot be hard deleted.");
  });

  it("fails closed when owned businesses cannot be proven fake/test/internal", () => {
    expect(sql).toContain("v_owned_business_count integer := 0");
    expect(sql).toContain("v_business_marker_count integer := 0");
    expect(sql).toContain("IF v_owned_business_count > 0 AND v_business_marker_count = 0 THEN");
    expect(sql).toContain("v_real_business_count := v_owned_business_count");
    expect(sql).toContain(
      "A business owned by this user is not marked as fake, test, internal, seeded, or hard-deletable."
    );
  });

  it("blocks target-owned businesses with unsafe marker values and real vendor members", () => {
    expect(sql).toContain("owner_user_id = %L::uuid AND NOT (%s)");
    expect(sql).toContain("A business owned by this user has real vendor members and cannot be hard deleted.");
    expect(sql).toContain("public._admin_hd_column_exists('businesses', 'is_internal')");
    expect(sql).toContain("public._admin_hd_column_exists('businesses', 'is_test')");
    expect(sql).toContain("public._admin_hd_column_exists('businesses', 'is_seeded')");
    expect(sql).toContain("public._admin_hd_column_exists('businesses', 'allow_hard_delete')");
    expect(sql).toContain("JOIN public.users member_user ON member_user.id = vm.user_id");
  });

  it("uses dynamic business safety markers for delete and avoids broad owner deletes", () => {
    expect(sql).toContain("v_business_delete_predicate := format('owner_user_id = %L::uuid AND false'");
    expect(sql).toContain("owner_user_id = %L::uuid AND (%s)");
    expect(sql).toContain(
      "public._admin_hd_delete_if_columns('businesses', ARRAY['owner_user_id'], v_business_delete_predicate)"
    );
    expect(sql).not.toContain(
      "public._admin_hd_delete_if_columns('businesses', ARRAY['owner_user_id'], format('owner_user_id = %L::uuid', p_target_user_id))"
    );
  });

  it("blocks real commerce with optional Stripe/payment columns guarded", () => {
    expect(sql).toContain("This user has real commerce records and cannot be hard deleted.");
    expect(sql).toContain("public._admin_hd_column_exists('orders', 'paid_at')");
    expect(sql).toContain("public._admin_hd_column_exists('orders', 'stripe_payment_intent_id')");
    expect(sql).toContain("public._admin_hd_table_has_columns('orders', ARRAY['id', 'user_id', 'vendor_id', 'status'])");
  });

  it("guards optional tables and columns before cleanup predicates", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public._admin_hd_table_has_columns");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public._admin_hd_count_if_columns");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public._admin_hd_delete_if_columns");
    expect(sql).toContain("public._admin_hd_column_exists('moderation_flags', 'target_listing_id')");
    expect(sql).toContain("public._admin_hd_column_exists('media_assets', 'business_id')");
    expect(sql).toContain("public._admin_hd_column_exists('vendor_members', 'business_entity_id')");
  });

  it("returns actual execute counts separately from preview counts", () => {
    expect(sql).toContain("v_deleted_counts jsonb := '{}'::jsonb");
    expect(sql).toContain("'preview_counts', v_counts");
    expect(sql).toContain("'deleted_counts', v_deleted_counts");
    expect(sql).toContain("'counts', v_deleted_counts");
  });
});
