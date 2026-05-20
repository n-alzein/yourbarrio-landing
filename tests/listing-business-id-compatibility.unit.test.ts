import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getCanonicalBusinessIdForListing,
  getLegacyListingOwnerUserId,
  getListingBusinessIdentity,
} from "@/lib/listings/businessIdentity";

const migration = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260519183000_listing_business_entity_compatibility.sql"
  ),
  "utf8"
);

const publicListingDetailsSource = readFileSync(
  path.join(process.cwd(), "lib/listings/publicListingDetails.js"),
  "utf8"
);

const customerListingRouteSource = readFileSync(
  path.join(process.cwd(), "app/api/customer/listings/route.js"),
  "utf8"
);

const publicBusinessProfileSource = readFileSync(
  path.join(process.cwd(), "app/(public)/(marketing)/b/[id]/page.jsx"),
  "utf8"
);

const homeListingsSource = readFileSync(
  path.join(process.cwd(), "lib/home/getHomeListings.server.js"),
  "utf8"
);

const searchRouteSource = readFileSync(
  path.join(process.cwd(), "app/api/search/route.js"),
  "utf8"
);

const categoryListingsSource = readFileSync(
  path.join(process.cwd(), "lib/categoryListingsCached.ts"),
  "utf8"
);

const customerCategorySource = readFileSync(
  path.join(process.cwd(), "app/(customer)/category/[slug]/page.js"),
  "utf8"
);

function activeListingLimitCount(listings: Array<Record<string, unknown>>, business: { id: string; owner_user_id: string }, currentId: string) {
  return listings.filter((listing) => {
    if (listing.id === currentId) return false;
    if (listing.status !== "published") return false;
    if (listing.admin_hidden === true) return false;
    if (listing.deleted_at != null) return false;

    return (
      listing.business_entity_id === business.id ||
      (listing.business_entity_id == null && listing.business_id === business.owner_user_id) ||
      listing.business_id === business.owner_user_id
    );
  }).length;
}

function wouldCheckActiveListingLimit(listing: Record<string, unknown>) {
  return listing.status === "published";
}

function canReadPublicListing(listing: Record<string, unknown>, businesses: Array<Record<string, unknown>>) {
  return businesses.some((business) => {
    const matches =
      business.id === listing.business_entity_id ||
      (listing.business_entity_id == null && business.owner_user_id === listing.business_id);
    return matches && ["auto_verified", "manually_verified"].includes(String(business.verification_status || ""));
  });
}

function canOwnerManageListing(listing: Record<string, unknown>, businesses: Array<Record<string, unknown>>, authUserId: string) {
  return (
    listing.business_id === authUserId ||
    businesses.some((business) => business.id === listing.business_entity_id && business.owner_user_id === authUserId)
  );
}

function canReadListingMedia(listing: Record<string, unknown>, businesses: Array<Record<string, unknown>>) {
  return businesses.some((business) => {
    const matches =
      business.id === listing.business_entity_id ||
      (listing.business_entity_id == null && business.owner_user_id === listing.business_id);
    const visibleBusiness =
      ["verified", "approved", "auto_verified", "manually_verified"].includes(String(business.verification_status || "")) ||
      business.is_internal === true;
    return (
      matches &&
      visibleBusiness &&
      listing.status === "published" &&
      listing.admin_hidden !== true &&
      listing.deleted_at == null
    );
  });
}

describe("listing business id compatibility", () => {
  it("adds and backfills the canonical listing business reference without dropping the legacy field", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS business_entity_id uuid");
    expect(migration).toContain("REFERENCES public.businesses(id) ON DELETE SET NULL");
    expect(migration).toContain("UPDATE public.listings l");
    expect(migration).toContain("b.owner_user_id = l.business_id");
    expect(migration).toContain("WHERE l.business_entity_id IS NULL");
    expect(migration).not.toContain("DROP COLUMN business_id");
    expect(migration).not.toContain("RENAME COLUMN business_id");
  });

  it("documents the transitional ownership state and keeps helpful indexes", () => {
    expect(migration).toContain("COMMENT ON COLUMN public.listings.business_id");
    expect(migration).toContain("Legacy field");
    expect(migration).toContain("COMMENT ON COLUMN public.listings.business_entity_id");
    expect(migration).toContain("Canonical reference to businesses.id");
    expect(migration).toContain("CREATE INDEX IF NOT EXISTS listings_business_entity_id_idx");
    expect(migration).toContain("CREATE INDEX IF NOT EXISTS listings_business_entity_active_idx");
  });

  it("populates canonical ownership for new browser-created listings", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.set_listing_business_entity_id()");
    expect(migration).toContain("NEW.business_entity_id IS NULL");
    expect(migration).toContain("WHERE b.owner_user_id = NEW.business_id");
    expect(migration).toContain("CREATE TRIGGER listings_set_business_entity_id");
  });

  it("does not overwrite an explicit canonical business id", () => {
    const setterStart = migration.indexOf("CREATE OR REPLACE FUNCTION public.set_listing_business_entity_id()");
    const setterEnd = migration.indexOf("DROP TRIGGER IF EXISTS listings_set_business_entity_id", setterStart);
    const setter = migration.slice(setterStart, setterEnd);

    expect(setter).toContain("IF NEW.business_entity_id IS NULL AND NEW.business_id IS NOT NULL THEN");
    expect(setter).toContain("INTO NEW.business_entity_id");
    expect(setter).not.toContain("IF NEW.business_entity_id IS NOT NULL");
  });

  it("updates public visibility and RLS to understand canonical and legacy ownership", () => {
    expect(migration).toContain("OR (listings.business_entity_id IS NULL AND b.owner_user_id = listings.business_id)");
    expect(migration).toContain("auth.uid() = business_id");
    expect(migration).toContain("b.id = listings.business_entity_id");
    expect(migration).toContain("b.owner_user_id = auth.uid()");
    expect(migration).toContain("l.business_entity_id");
    expect(migration).toContain("OR (l.business_entity_id IS NULL AND b.owner_user_id = l.business_id)");
  });

  it("keeps active listing limit counting compatible without double-counting rows with both ids", () => {
    const business = {
      id: "11111111-1111-4111-8111-111111111111",
      owner_user_id: "22222222-2222-4222-8222-222222222222",
    };
    const listings = [
      {
        id: "legacy",
        business_id: business.owner_user_id,
        business_entity_id: null,
        status: "published",
        admin_hidden: false,
        deleted_at: null,
      },
      {
        id: "canonical",
        business_id: "00000000-0000-4000-8000-000000000000",
        business_entity_id: business.id,
        status: "published",
        admin_hidden: false,
        deleted_at: null,
      },
      {
        id: "both",
        business_id: business.owner_user_id,
        business_entity_id: business.id,
        status: "published",
        admin_hidden: false,
        deleted_at: null,
      },
      {
        id: "draft",
        business_id: business.owner_user_id,
        business_entity_id: business.id,
        status: "draft",
        admin_hidden: false,
        deleted_at: null,
      },
    ];

    expect(activeListingLimitCount(listings, business, "new-listing")).toBe(3);
    expect(activeListingLimitCount(listings, business, "both")).toBe(2);
    expect(wouldCheckActiveListingLimit({ status: "draft", admin_hidden: false, deleted_at: null })).toBe(false);
    expect(wouldCheckActiveListingLimit({ status: "published", admin_hidden: true, deleted_at: null })).toBe(true);
    expect(wouldCheckActiveListingLimit({ status: "published", admin_hidden: false, deleted_at: "2026-05-01" })).toBe(true);
    expect(migration).toContain("BEFORE INSERT OR UPDATE OF status, admin_hidden, deleted_at ON public.listings");
  });

  it("uses canonical-first public business resolution and keeps public listing surfaces on the compatibility view", () => {
    const canonicalBusiness = {
      id: "canonical-business",
      owner_user_id: "canonical-owner",
      verification_status: "auto_verified",
    };
    const legacyBusiness = {
      id: "legacy-business",
      owner_user_id: "legacy-owner",
      verification_status: "auto_verified",
    };

    expect(canReadPublicListing({ business_entity_id: canonicalBusiness.id, business_id: "legacy-owner" }, [canonicalBusiness, legacyBusiness])).toBe(true);
    expect(canReadPublicListing({ business_entity_id: null, business_id: legacyBusiness.owner_user_id }, [canonicalBusiness, legacyBusiness])).toBe(true);
    expect(canReadPublicListing({ business_entity_id: "unverified-business", business_id: legacyBusiness.owner_user_id }, [legacyBusiness])).toBe(false);
    expect(publicBusinessProfileSource).toContain('.from("public_listings_v")');
    expect(homeListingsSource).toContain('.from("public_listings_v")');
    expect(searchRouteSource).toContain('.from("public_listings_v")');
    expect(categoryListingsSource).toContain('.from("public_listings_v")');
    expect(customerCategorySource).toContain('.from("public_listings_v")');
  });

  it("preserves public_listings_v column order and appends new compatibility columns", () => {
    expect(migration).toContain("current_view_has_is_test");
    expect(migration).toContain("WHEN current_view_has_is_test THEN 'l.is_test,'");
    expect(migration).toContain("WHEN has_is_test AND NOT current_view_has_is_test THEN ', l.is_test'");
    expect(migration).not.toContain("WHEN has_is_test THEN 'l.is_test,'");
    expect(migration).not.toContain("ELSE 'false AS is_test,'");

    const viewStart = migration.indexOf("CREATE OR REPLACE VIEW public.public_listings_v AS");
    const viewEnd = migration.indexOf("FROM public.listings l", viewStart);
    const selectList = migration.slice(viewStart, viewEnd);
    const createdAtIndex = selectList.indexOf("l.created_at");
    const inventoryIndex = selectList.indexOf("l.inventory_quantity");
    const listingCategoryIdIndex = selectList.indexOf("l.listing_category_id%s");
    const businessEntityIndex = selectList.indexOf("l.business_entity_id");

    expect(createdAtIndex).toBeGreaterThan(-1);
    expect(inventoryIndex).toBeGreaterThan(createdAtIndex);
    expect(listingCategoryIdIndex).toBeGreaterThan(inventoryIndex);
    expect(businessEntityIndex).toBeGreaterThan(listingCategoryIdIndex);
  });

  it("allows business-owner listing access through legacy or canonical ownership", () => {
    const businesses = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        owner_user_id: "22222222-2222-4222-8222-222222222222",
      },
    ];

    expect(canOwnerManageListing({ business_id: "22222222-2222-4222-8222-222222222222", business_entity_id: null }, businesses, "22222222-2222-4222-8222-222222222222")).toBe(true);
    expect(canOwnerManageListing({ business_id: null, business_entity_id: "11111111-1111-4111-8111-111111111111" }, businesses, "22222222-2222-4222-8222-222222222222")).toBe(true);
    expect(canOwnerManageListing({ business_id: "33333333-3333-4333-8333-333333333333", business_entity_id: "11111111-1111-4111-8111-111111111111" }, businesses, "22222222-2222-4222-8222-222222222222")).toBe(true);
    expect(canOwnerManageListing({ business_id: "33333333-3333-4333-8333-333333333333", business_entity_id: null }, businesses, "22222222-2222-4222-8222-222222222222")).toBe(false);
  });

  it("keeps listing media visible through legacy-only, canonical-only, and both-field ownership", () => {
    const business = {
      id: "11111111-1111-4111-8111-111111111111",
      owner_user_id: "22222222-2222-4222-8222-222222222222",
      verification_status: "auto_verified",
    };

    expect(canReadListingMedia({ business_id: business.owner_user_id, business_entity_id: null, status: "published", admin_hidden: false, deleted_at: null }, [business])).toBe(true);
    expect(canReadListingMedia({ business_id: null, business_entity_id: business.id, status: "published", admin_hidden: false, deleted_at: null }, [business])).toBe(true);
    expect(canReadListingMedia({ business_id: business.owner_user_id, business_entity_id: business.id, status: "published", admin_hidden: false, deleted_at: null }, [business])).toBe(true);
    expect(canReadListingMedia({ business_id: business.owner_user_id, business_entity_id: business.id, status: "draft", admin_hidden: false, deleted_at: null }, [business])).toBe(false);
    expect(migration).toContain("CREATE POLICY media_assets_public_active_select");
    expect(migration).toContain("ON b.id = l.business_entity_id");
    expect(migration).toContain("OR (l.business_entity_id IS NULL AND b.owner_user_id = l.business_id)");
  });

  it("keeps public listing detail reads on a shared listing business resolver", () => {
    expect(publicListingDetailsSource).toContain("getPublicBusinessForListing");
    expect(customerListingRouteSource).toContain("getPublicBusinessForListing");
    expect(publicListingDetailsSource).not.toContain("getPublicBusinessByOwnerId(listing.business_id");
    expect(customerListingRouteSource).not.toContain("getPublicBusinessByOwnerId(listing.business_id");
  });

  it("exposes small helpers for canonical and legacy listing ownership ids", () => {
    const listing = {
      business_entity_id: "11111111-1111-4111-8111-111111111111",
      business_id: "22222222-2222-4222-8222-222222222222",
    };

    expect(getCanonicalBusinessIdForListing(listing)).toBe("11111111-1111-4111-8111-111111111111");
    expect(getLegacyListingOwnerUserId(listing)).toBe("22222222-2222-4222-8222-222222222222");
    expect(getListingBusinessIdentity(listing)).toEqual({
      businessEntityId: "11111111-1111-4111-8111-111111111111",
      ownerUserId: "22222222-2222-4222-8222-222222222222",
    });
  });
});
