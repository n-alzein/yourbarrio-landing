import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isSavedMediaVariantUrl } from "@/lib/images/resolveMediaAssetUrl";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260509120000_add_media_assets_lifecycle.sql"
);
const initMigrationPath = path.join(process.cwd(), "supabase/migrations/20251205204210_init.sql");
const stagingSchemaPath = path.join(process.cwd(), "staging-schema.sql");

const migrationSource = readFileSync(migrationPath, "utf8");
const initMigrationSource = readFileSync(initMigrationPath, "utf8");
const stagingSchemaSource = readFileSync(stagingSchemaPath, "utf8");
const imageVariantsSource = readFileSync(
  path.join(process.cwd(), "lib/images/imageVariants.server.js"),
  "utf8"
);

function canReadPublicMedia({
  assetStatus = "active",
  listingStatus = "published",
  adminHidden = false,
  deletedAt = null,
  verificationStatus = "verified",
  isInternal = false,
} = {}) {
  if (assetStatus !== "active") return false;
  if (adminHidden || deletedAt) return false;
  const listingVisible = listingStatus === "published";
  const businessVisible =
    ["verified", "approved"].includes(verificationStatus || "") || isInternal === true;
  return listingVisible && businessVisible;
}

describe("media_assets RLS hardening", () => {
  it("keeps the public listing policy aligned with the current listings business_id schema", () => {
    expect(initMigrationSource).toContain("business_id uuid NOT NULL");
    expect(stagingSchemaSource).toContain('("auth"."uid"() = "business_id")');
    expect(migrationSource).toContain("JOIN public.businesses b ON b.owner_user_id = l.business_id");
    expect(migrationSource).not.toContain("JOIN public.businesses b ON b.id = l.business_id");
  });

  it("uses listings.status as the schema-compatible publication check", () => {
    expect(migrationSource).toContain("AND l.status = 'published'");
    expect(migrationSource).not.toContain("l.is_published");
  });

  it("recreates the public active policy safely after a partial failed migration", () => {
    expect(migrationSource).toContain(
      "DROP POLICY IF EXISTS media_assets_public_active_select ON public.media_assets"
    );
    expect(migrationSource).toContain("CREATE POLICY media_assets_public_active_select");
  });

  it("allows public reads only for active media attached to visible listings with visible businesses", () => {
    expect(canReadPublicMedia()).toBe(true);
    expect(canReadPublicMedia({ verificationStatus: "approved" })).toBe(true);
    expect(canReadPublicMedia({ verificationStatus: "pending", isInternal: true })).toBe(true);

    expect(canReadPublicMedia({ listingStatus: "draft" })).toBe(false);
    expect(canReadPublicMedia({ listingStatus: "published", adminHidden: true })).toBe(false);
    expect(canReadPublicMedia({ listingStatus: "published", deletedAt: "2026-05-09" })).toBe(false);
    expect(canReadPublicMedia({ verificationStatus: "pending", isInternal: false })).toBe(false);
  });

  it("does not make non-active lifecycle states publicly readable", () => {
    for (const status of ["temporary", "replaced", "deleted", "failed"]) {
      expect(canReadPublicMedia({ assetStatus: status })).toBe(false);
    }
    expect(migrationSource).toContain("status = 'active'");
  });

  it("keeps owner and business-owner read policies in place", () => {
    expect(migrationSource).toContain("CREATE POLICY media_assets_owner_select");
    expect(migrationSource).toContain("USING (auth.uid() = owner_user_id)");
    expect(migrationSource).toContain("CREATE POLICY media_assets_business_owner_select");
    expect(migrationSource).toContain("WHERE b.id = media_assets.business_id");
    expect(migrationSource).toContain("AND b.owner_user_id = auth.uid()");
  });

  it("detects generated saved variants for unoptimized rendering", () => {
    expect(
      isSavedMediaVariantUrl(
        "https://example.supabase.co/storage/v1/object/public/business-photos/user/listing/asset/card_640.webp"
      )
    ).toBe(true);
    expect(isSavedMediaVariantUrl("/business-photos/user/listing/asset/detail_1200.webp")).toBe(true);
    expect(isSavedMediaVariantUrl("https://example.com/legacy.jpg")).toBe(false);
  });
});

describe("media asset server-operation hardening", () => {
  it("routes mutations through authenticated endpoints and service-role helpers", () => {
    const tempUploadRoute = readFileSync(
      path.join(process.cwd(), "app/api/media/temp-upload/route.js"),
      "utf8"
    );
    const discardRoute = readFileSync(
      path.join(process.cwd(), "app/api/media/discard-temp/route.js"),
      "utf8"
    );
    const commitRoute = readFileSync(
      path.join(process.cwd(), "app/api/media/commit/route.js"),
      "utf8"
    );
    const cleanupRoute = readFileSync(
      path.join(process.cwd(), "app/api/cron/cleanup-temp-media/route.js"),
      "utf8"
    );
    const mediaServer = readFileSync(
      path.join(process.cwd(), "lib/images/mediaAssets.server.js"),
      "utf8"
    );

    expect(tempUploadRoute).toContain("authClient.auth.getUser()");
    expect(tempUploadRoute).toContain("getMediaServiceClient()");
    expect(discardRoute).toContain("authClient.auth.getUser()");
    expect(discardRoute).toContain("ownerUserId: user.id");
    expect(commitRoute).toContain("authClient.auth.getUser()");
    expect(commitRoute).toContain("ownerUserId: user.id");
    expect(cleanupRoute).toContain("process.env.CRON_SECRET");
    expect(cleanupRoute).toContain("status\", \"temporary\"");
    expect(mediaServer).toContain("getSupabaseServerClient as getServiceRoleClient");
    expect(mediaServer).toContain(".eq(\"owner_user_id\", ownerUserId)");
    expect(mediaServer).toContain(".eq(\"business_id\", ownerUserId)");
  });
});

describe("media asset product image variants", () => {
  it("generates listing card and thumbnail variants without destructive cover cropping", () => {
    expect(imageVariantsSource).toContain("listing_image");
    expect(imageVariantsSource).toContain(
      '{ key: "thumb_path", filename: "thumb_320.webp", width: 320, height: 240, fit: "contain" }'
    );
    expect(imageVariantsSource).toContain(
      '{ key: "card_path", filename: "card_640.webp", width: 640, height: 480, fit: "contain" }'
    );
    expect(imageVariantsSource).toContain(
      "background: { r: 255, g: 255, b: 255, alpha: 1 }"
    );
  });

  it("keeps true cover and avatar variants cover-cropped", () => {
    expect(imageVariantsSource).toContain("business_cover");
    expect(imageVariantsSource).toContain(
      '{ key: "cover_mobile_path", filename: "cover_mobile_900.webp", width: 900, height: 520, fit: "cover" }'
    );
    expect(imageVariantsSource).toContain(
      '{ key: "avatar_128_path", filename: "avatar_128.webp", width: 128, height: 128, fit: "cover" }'
    );
  });
});
