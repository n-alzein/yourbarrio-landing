import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationSource = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260424130000_add_listing_variants_phase_1.sql"
  ),
  "utf8"
);
const correctiveMigrationSource = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260424153000_fix_replace_listing_option_tree.sql"
  ),
  "utf8"
);
const rpcRegressionSource = readFileSync(
  path.join(
    process.cwd(),
    "docs/security/listing-variants-rpc-regression.sql"
  ),
  "utf8"
);

describe("listing variants phase 1 migration", () => {
  it("uses helper-based listing visibility instead of raw parent existence checks", () => {
    expect(migrationSource).toContain(
      "CREATE OR REPLACE FUNCTION public.can_read_listing_variant_source"
    );
    expect(migrationSource).toContain("FROM public.public_listings_v pl");
    expect(migrationSource).toContain("AND l.business_id = auth.uid()");
    expect(migrationSource).toContain(
      "USING (public.can_read_listing_variant_source(listing_attributes.listing_id))"
    );
    expect(migrationSource).toContain(
      "USING (public.can_read_listing_variant_source(listing_variants.listing_id))"
    );
    expect(migrationSource).toContain(
      "AND public.can_read_listing_variant_source(la.listing_id)"
    );
    expect(migrationSource).toContain(
      "AND public.can_read_listing_variant_source(lv.listing_id)"
    );
    expect(migrationSource).not.toContain(
      "WHERE l.id = listing_attributes.listing_id\n    )"
    );
    expect(migrationSource).not.toContain(
      "WHERE l.id = listing_variants.listing_id\n    )"
    );
    expect(migrationSource).not.toContain(
      "FROM public.listings l\n        WHERE l.id = p_listing_id\n      )"
    );
  });

  it("keeps manage access scoped to owners or admin ops", () => {
    expect(migrationSource).toContain(
      "CREATE OR REPLACE FUNCTION public.can_manage_listing_variant_source"
    );
    expect(migrationSource).toContain("public.has_admin_role('admin_ops')");
    expect(migrationSource).toContain("AND l.business_id = auth.uid()");
  });

  it("keeps replace_listing_option_tree invoker-scoped", () => {
    expect(migrationSource).toContain(
      "Invoker-scoped listing option replacement. Relies on explicit can_manage_listing_variant_source() checks"
    );
    expect(migrationSource).not.toContain(
      "CREATE OR REPLACE FUNCTION public.replace_listing_option_tree(\n  p_listing_id uuid,\n  p_payload jsonb DEFAULT '{}'::jsonb\n)\nRETURNS jsonb\nLANGUAGE plpgsql\nSECURITY DEFINER"
    );
  });

  it("ships a forward corrective migration for replace_listing_option_tree without jsonb key maps", () => {
    expect(correctiveMigrationSource).toContain(
      "CREATE OR REPLACE FUNCTION public.replace_listing_option_tree"
    );
    expect(correctiveMigrationSource).toContain(
      "JOIN public.listing_attribute_values lav"
    );
    expect(correctiveMigrationSource).toContain(
      "la.listing_id = p_listing_id"
    );
    expect(correctiveMigrationSource).toContain(
      "lower(regexp_replace(btrim(la.name), '\\s+', ' ', 'g')) = v_attribute_name_key"
    );
    expect(correctiveMigrationSource).not.toContain("SECURITY DEFINER");
    expect(correctiveMigrationSource).not.toContain("v_value_map");
    expect(correctiveMigrationSource).not.toContain("v_attribute_map");
  });

  it("replaces the old cart uniqueness with partial unique indexes", () => {
    const withoutVariantIndexPosition = migrationSource.indexOf(
      "CREATE UNIQUE INDEX IF NOT EXISTS cart_items_cart_listing_without_variant_unique_idx"
    );
    const withVariantIndexPosition = migrationSource.indexOf(
      "CREATE UNIQUE INDEX IF NOT EXISTS cart_items_cart_listing_variant_unique_idx"
    );
    const dropConstraintPosition = migrationSource.indexOf(
      "ALTER TABLE public.cart_items\n  DROP CONSTRAINT IF EXISTS cart_items_cart_listing_key;"
    );

    expect(withoutVariantIndexPosition).toBeGreaterThan(-1);
    expect(withVariantIndexPosition).toBeGreaterThan(-1);
    expect(dropConstraintPosition).toBeGreaterThan(-1);
    expect(withoutVariantIndexPosition).toBeLessThan(dropConstraintPosition);
    expect(withVariantIndexPosition).toBeLessThan(dropConstraintPosition);
  });

  it("uses a real existing owner identity in the RPC regression harness", () => {
    expect(rpcRegressionSource).toContain(
      "FROM public.businesses b"
    );
    expect(rpcRegressionSource).toContain(
      "JOIN public.users u"
    );
    expect(rpcRegressionSource).toContain(
      "b.owner_user_id AS actor_user_id"
    );
    expect(rpcRegressionSource).not.toContain(
      "gen_random_uuid() AS actor_user_id"
    );
  });
});
