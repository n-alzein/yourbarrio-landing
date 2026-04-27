import { describe, expect, it, vi } from "vitest";
import {
  buildBusinessGeocodeAddress,
  normalizeCoordinates,
  resolveBusinessCoordinates,
} from "@/lib/location/businessGeocoding";

describe("businessGeocoding", () => {
  it("builds a full address line from business location fields", () => {
    expect(
      buildBusinessGeocodeAddress({
        address: "123 Main St",
        address_2: "Suite 5",
        city: "Los Angeles",
        state: "CA",
        postal_code: "90001",
      })
    ).toBe("123 Main St, Suite 5, Los Angeles, CA, 90001");
  });

  it("normalizes alternate coordinate field shapes", () => {
    expect(normalizeCoordinates({ lat: "34.05", lng: "-118.25" })).toEqual({
      lat: 34.05,
      lng: -118.25,
    });
    expect(normalizeCoordinates({ center: { lat: 34.05, lng: -118.25 } })).toEqual({
      lat: 34.05,
      lng: -118.25,
    });
  });

  it("preserves existing coordinates when geocoding fails", async () => {
    const logger = { error: vi.fn() };
    const fetchImpl = vi.fn().mockRejectedValue(new Error("boom"));
    process.env.MAPBOX_GEOCODING_TOKEN = "test-token";

    const result = await resolveBusinessCoordinates({
      nextLocation: {
        address: "123 Main St",
        city: "Los Angeles",
        state: "CA",
      },
      previousLocation: {
        latitude: 34.0522,
        longitude: -118.2437,
      },
      fetchImpl,
      logger,
    });

    expect(result).toEqual({
      coords: { lat: 34.0522, lng: -118.2437 },
      source: "preserved_existing",
    });
    expect(logger.error).toHaveBeenCalled();
    delete process.env.MAPBOX_GEOCODING_TOKEN;
  });
});
