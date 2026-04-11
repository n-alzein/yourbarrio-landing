import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAUNCH_LOCATION,
  getDefaultLaunchLocation,
  getInitialLaunchLocation,
  getLocationSourcePriority,
  shouldPromoteLocation,
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

  it("uses a saved manual location for launch bootstrap when one exists", () => {
    expect(
      getInitialLaunchLocation({
        source: "manual",
        city: "San Diego",
        region: "CA",
        lat: 32.7157,
        lng: -117.1611,
        updatedAt: 456,
      })
    ).toMatchObject({
      source: "manual",
      city: "San Diego",
      region: "CA",
      updatedAt: 456,
    });
  });

  it("never lets generic IP promotion replace the launch default", () => {
    expect(
      shouldPromoteLocation(
        { source: "default", city: "Long Beach", region: "CA" },
        { source: "ip", city: "Los Angeles", region: "CA" }
      )
    ).toBe(false);
  });
});
