import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAUNCH_LOCATION,
  getDefaultLaunchLocation,
  getLocationSourcePriority,
} from "@/lib/location/defaults";
import { normalizeLocationState } from "@/lib/location/locationCookie";

describe("launch location defaults", () => {
  it("normalizes the shared Long Beach launch fallback as a valid location", () => {
    const normalized = normalizeLocationState(getDefaultLaunchLocation(123));

    expect(normalized).toMatchObject({
      source: "default",
      city: "Long Beach",
      region: "CA",
      country: "US",
      lat: 33.7701,
      lng: -118.1937,
      updatedAt: 123,
    });
  });

  it("keeps the priority order manual > gps > ip > default", () => {
    expect(getLocationSourcePriority("manual")).toBeGreaterThan(
      getLocationSourcePriority("gps")
    );
    expect(getLocationSourcePriority("gps")).toBeGreaterThan(
      getLocationSourcePriority("ip")
    );
    expect(getLocationSourcePriority("ip")).toBeGreaterThan(
      getLocationSourcePriority(DEFAULT_LAUNCH_LOCATION.source)
    );
  });
});
