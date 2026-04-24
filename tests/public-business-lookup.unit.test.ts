import { describe, expect, it, vi } from "vitest";
import { getBusinessPublicUrl } from "@/lib/ids/publicRefs";
import { getPublicBusinessByOwnerId } from "@/lib/business/getPublicBusinessByOwnerId";
import { getPublicBusinessByPublicId } from "@/lib/business/getPublicBusinessByPublicId";

function createQueryResult(data: any) {
  return {
    in() {
      return this;
    },
    eq() {
      return this;
    },
    is() {
      return this;
    },
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

describe("public business lookup helpers", () => {
  it("opens a Test Store 2 style business by public_id even when coordinates are null", async () => {
    const data = {
      id: "biz-row-1",
      owner_user_id: "11111111-1111-4111-8111-111111111111",
      public_id: "eaca122466",
      business_name: "Test Store 2",
      business_type: "Retail",
      category: "Retail",
      description: "Public test store",
      website: null,
      phone: null,
      profile_photo_url: null,
      cover_photo_url: null,
      address: null,
      address_2: null,
      city: "Los Angeles",
      state: "CA",
      postal_code: "90001",
      pickup_enabled_default: true,
      local_delivery_enabled_default: false,
      default_delivery_fee_cents: null,
      delivery_radius_miles: null,
      delivery_min_order_cents: null,
      delivery_notes: null,
      latitude: null,
      longitude: null,
      hours_json: {},
      social_links_json: {},
      is_internal: false,
      verification_status: "manually_verified",
      account_status: "active",
      deleted_at: null,
    };
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => createQueryResult(data)),
      })),
    };

    const profile = await getPublicBusinessByPublicId("eaca122466", { client });

    expect(profile?.public_id).toBe("eaca122466");
    expect(profile?.business_name).toBe("Test Store 2");
    expect(profile?.latitude).toBeNull();
    expect(profile?.longitude).toBeNull();
    expect(getBusinessPublicUrl(profile || {})).toBe("/b/eaca122466");
  });

  it("does not treat a public_id slug as an owner_user_id lookup", async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => createQueryResult(null)),
      })),
    };

    const profile = await getPublicBusinessByOwnerId("eaca122466", { client });

    expect(profile).toBeNull();
  });

  it("tile hrefs use the public_id lookup path", async () => {
    const tile = {
      id: "11111111-1111-4111-8111-111111111111",
      public_id: "eaca122466",
    };
    const data = {
      id: "biz-row-1",
      owner_user_id: tile.id,
      public_id: tile.public_id,
      business_name: "Test Store 2",
      business_type: "Retail",
      category: "Retail",
      description: null,
      website: null,
      phone: null,
      profile_photo_url: null,
      cover_photo_url: null,
      address: null,
      address_2: null,
      city: "Los Angeles",
      state: "CA",
      postal_code: "90001",
      pickup_enabled_default: true,
      local_delivery_enabled_default: false,
      default_delivery_fee_cents: null,
      delivery_radius_miles: null,
      delivery_min_order_cents: null,
      delivery_notes: null,
      latitude: null,
      longitude: null,
      hours_json: {},
      social_links_json: {},
      is_internal: false,
      verification_status: "manually_verified",
      account_status: "active",
      deleted_at: null,
    };
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => createQueryResult(data)),
      })),
    };

    const href = getBusinessPublicUrl(tile);
    const slug = href.split("/b/")[1];
    const profile = await getPublicBusinessByPublicId(slug, { client });

    expect(profile?.owner_user_id).toBe(tile.id);
    expect(profile?.public_id).toBe(tile.public_id);
  });
});
