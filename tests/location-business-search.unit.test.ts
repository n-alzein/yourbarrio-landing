import { describe, expect, it, vi } from "vitest";
import { findBusinessesForLocation } from "@/lib/location/businessLocationSearch";

function createSupabaseMock(rows) {
  const limit = vi.fn().mockResolvedValue({ data: rows, error: null });
  const query = {
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    is: vi.fn(() => query),
    order: vi.fn(() => query),
    limit,
  };
  const select = vi.fn(() => query);
  const from = vi.fn(() => ({ select }));

  return {
    from,
    __mocks: {
      query,
      select,
      limit,
    },
  };
}

describe("findBusinessesForLocation", () => {
  it("keeps exact city+state matches with null coords when selected location has coords", async () => {
    const supabase = createSupabaseMock([
      {
        id: "ca-coords",
        owner_user_id: "owner-ca-coords",
        city: "Long Beach",
        state: "CA",
        latitude: 33.7701,
        longitude: -118.1937,
        verification_status: "manually_verified",
      },
      {
        id: "ca-null",
        owner_user_id: "owner-ca-null",
        city: "Long Beach",
        state: "CA",
        latitude: null,
        longitude: null,
        verification_status: "manually_verified",
      },
      {
        id: "ms-null",
        owner_user_id: "owner-ms-null",
        city: "Long Beach",
        state: "MS",
        latitude: null,
        longitude: null,
        verification_status: "manually_verified",
      },
    ]);

    const results = await findBusinessesForLocation(supabase, {
      city: "Long Beach",
      region: "California",
      lat: 33.7701,
      lng: -118.1937,
    });

    expect(results.map((row) => row.id)).toEqual(["ca-coords", "ca-null"]);
  });

  it("supports strict city+state matching for city-labeled homepage feeds", async () => {
    const supabase = createSupabaseMock([
      {
        id: "costa-mesa",
        owner_user_id: "owner-costa-mesa",
        city: "Costa Mesa",
        state: "CA",
        latitude: 33.6411,
        longitude: -117.9187,
        verification_status: "manually_verified",
      },
      {
        id: "long-beach",
        owner_user_id: "owner-long-beach",
        city: "Long Beach",
        state: "CA",
        address: "2603 E Ocean Blvd",
        latitude: 33.7629,
        longitude: -118.1618,
        verification_status: "manually_verified",
      },
    ]);

    const selected = {
      city: "Costa Mesa",
      region: "CA",
      lat: 33.6411,
      lng: -117.9187,
    };

    const nearbyResults = await findBusinessesForLocation(supabase, selected, {
      radiusKm: 50,
    });
    const strictResults = await findBusinessesForLocation(supabase, selected, {
      strictCityState: true,
    });

    expect(nearbyResults.map((row) => row.id)).toEqual(["costa-mesa", "long-beach"]);
    expect(strictResults.map((row) => row.id)).toEqual(["costa-mesa"]);
  });
});
