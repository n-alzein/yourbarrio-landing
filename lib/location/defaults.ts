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

function hasUsableLocationShape(location: any): boolean {
  if (!location || typeof location !== "object") return false;

  const city = String(location.city ?? "").trim();
  const region = String(location.region ?? location.state ?? "").trim();
  const lat = Number(location.lat);
  const lng = Number(location.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  return Boolean((city && region) || hasCoords);
}

export function getDefaultLaunchLocation(now = Date.now()) {
  return {
    ...DEFAULT_LAUNCH_LOCATION,
    updatedAt: now,
  };
}

export function getInitialLaunchLocation<T extends Record<string, any> | null | undefined>(
  savedLocation: T,
  now = Date.now()
) {
  if (hasUsableLocationShape(savedLocation)) {
    return {
      ...savedLocation,
      updatedAt: Number.isFinite(Number(savedLocation?.updatedAt))
        ? Number(savedLocation.updatedAt)
        : now,
    };
  }

  return getDefaultLaunchLocation(now);
}

export function shouldPromoteLocation(
  current: { source?: unknown } | null | undefined,
  incoming: { source?: unknown } | null | undefined,
  {
    allowGpsPromotion = true,
    allowIpPromotion = false,
  }: {
    allowGpsPromotion?: boolean;
    allowIpPromotion?: boolean;
  } = {}
) {
  const currentSource = current?.source;
  const incomingSource = incoming?.source;

  if (!incomingSource) return true;
  if (!currentSource) return true;

  if (incomingSource === "manual") return true;
  if (currentSource === "manual" && incomingSource !== "manual") return false;

  if (incomingSource === "gps") {
    return (
      allowGpsPromotion &&
      getLocationSourcePriority(incomingSource) > getLocationSourcePriority(currentSource)
    );
  }

  if (incomingSource === "ip") {
    return (
      allowIpPromotion &&
      getLocationSourcePriority(incomingSource) > getLocationSourcePriority(currentSource)
    );
  }

  return getLocationSourcePriority(incomingSource) > getLocationSourcePriority(currentSource);
}
