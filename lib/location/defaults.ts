export const DEFAULT_LAUNCH_LOCATION = Object.freeze({
  source: "default" as const,
  city: "Long Beach",
  region: "CA",
  state: "CA",
  country: "US",
  lat: 33.7701,
  lng: -118.1937,
  updatedAt: 0,
});

export type AppLocationSource = "manual" | "gps" | "ip" | "default";

export function isAppLocationSource(value: unknown): value is AppLocationSource {
  return value === "manual" || value === "gps" || value === "ip" || value === "default";
}

export function getLocationSourcePriority(value: unknown): number {
  switch (value) {
    case "manual":
      return 4;
    case "gps":
      return 3;
    case "ip":
      return 2;
    case "default":
      return 1;
    default:
      return 0;
  }
}

export function getDefaultLaunchLocation(now = Date.now()) {
  return {
    ...DEFAULT_LAUNCH_LOCATION,
    updatedAt: now,
  };
}
