import "server-only";

import { cookies } from "next/headers";
import { getDefaultLaunchLocation } from "@/lib/location/defaults";
import {
  decodeLocation,
  LEGACY_LOCATION_COOKIE_NAME,
  LOCATION_COOKIE_NAME,
  normalizeLocationState,
  type LocationState,
} from "@/lib/location/locationCookie";

export async function getLocationFromCookies(): Promise<LocationState | null> {
  try {
    const jar = await cookies();
    const primary = decodeLocation(jar.get(LOCATION_COOKIE_NAME)?.value || "");
    if (primary) return primary;
    const legacy = decodeLocation(jar.get(LEGACY_LOCATION_COOKIE_NAME)?.value || "");
    if (legacy) return legacy;
    return normalizeLocationState(getDefaultLaunchLocation());
  } catch {
    return normalizeLocationState(getDefaultLaunchLocation());
  }
}
