import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationSource = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260425123000_public_listings_view_respect_listing_status.sql"
  ),
  "utf8"
);

const coverMigrationSource = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260425153000_public_listings_view_add_cover_image_id.sql"
  ),
  "utf8"
);

describe("public listings view draft guard migration", () => {
  it("filters public_listings_v to published status when listings.status exists", () => {
    expect(migrationSource).toContain("column_name = 'status'");
    expect(migrationSource).toContain("WHERE l.status = 'published'");
  });

  it("preserves is_published checks when that moderation flag exists", () => {
    expect(migrationSource).toContain("column_name = 'is_published'");
    expect(migrationSource).toContain("AND l.is_published = true");
  });

  it("adds cover_image_id without reordering existing view columns", () => {
    expect(coverMigrationSource).toContain("l.photo_variants,");
    expect(coverMigrationSource).toContain("l.is_internal,");
    expect(coverMigrationSource).toContain("l.cover_image_id");
    expect(coverMigrationSource).not.toContain("l.cover_image_id,\n        l.is_internal");
  });
});
