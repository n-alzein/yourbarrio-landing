"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  buildLocationLabel,
  getDefaultLaunchLocation,
  getInitialLaunchLocation,
  hasLocation,
  isSameLocation,
  normalizeLocation,
  LOCATION_STORAGE_KEY,
  shouldPromoteLocation,
} from "@/lib/location";
import { readLocationClient, setLocationCookieClient } from "@/lib/location/setLocationCookieClient";
import { decodeHumanLocationString } from "@/lib/location/decodeHumanLocation";

const IP_REFRESH_TTL_MS = 24 * 60 * 60 * 1000;
const GPS_REFRESH_TTL_MS = 6 * 60 * 60 * 1000;
const LOCATION_USER_SET_KEY = "location_user_set";
const LOCATION_USER_SET_COOKIE = "location_user_set";
const USER_SET_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const DEBUG_LOCATION_BOOTSTRAP =
  process.env.NEXT_PUBLIC_DEBUG_LOCATION_BOOTSTRAP === "1";

const LocationContext = createContext(null);
export const LOCATION_CHANGED_EVENT = "yb:location-changed";

const buildLabel = (city, region) => {
  return buildLocationLabel(
    decodeHumanLocationString(city),
    decodeHumanLocationString(region)
  );
};

const isFresh = (location) => {
  if (!location || !Number.isFinite(Number(location.updatedAt))) return false;
  if (location.source === "manual") return true;
  if (location.source === "default") return true;
  const ttl = location.source === "gps" ? GPS_REFRESH_TTL_MS : IP_REFRESH_TTL_MS;
  return Date.now() - Number(location.updatedAt) <= ttl;
};

const normalizeForState = (next) => {
  const base = next && typeof next === "object" ? next : {};
  return normalizeLocation({
    ...base,
    city: decodeHumanLocationString(base.city),
    region: decodeHumanLocationString(base.region),
    country: decodeHumanLocationString(base.country),
    label: decodeHumanLocationString(base.label),
  });
};

const readCookie = (name) => {
  if (typeof document === "undefined") return "";
  const escaped = name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
};

const writeCookie = (name, value, maxAge) => {
  if (typeof document === "undefined") return;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:";
  const secureToken = secure ? "; secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax${secureToken}`;
};

const clearCookie = (name) => {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
};

const setUserSetFlagClient = (enabled) => {
  if (typeof window === "undefined") return;
  try {
    if (enabled) {
      window.localStorage.setItem(LOCATION_USER_SET_KEY, "1");
    } else {
      window.localStorage.removeItem(LOCATION_USER_SET_KEY);
    }
  } catch {
    // Ignore storage write failures.
  }
  if (enabled) {
    writeCookie(LOCATION_USER_SET_COOKIE, "1", USER_SET_COOKIE_MAX_AGE_SECONDS);
  } else {
    clearCookie(LOCATION_USER_SET_COOKIE);
  }
};

const logBootstrap = (...args) => {
  if (!DEBUG_LOCATION_BOOTSTRAP) return;
  console.info("[LocationProvider/bootstrap]", ...args);
};

export function LocationProvider({ children, initialLocation = null }) {
  // Keep initial render deterministic between server and client to avoid hydration mismatches.
  const [location, setLocationState] = useState(() =>
    normalizeForState(getInitialLaunchLocation(initialLocation || getDefaultLaunchLocation()))
  );
  const [hydrated, setHydrated] = useState(false);
  const locationRef = useRef(location);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  const applyLocation = useCallback((next, options = {}) => {
    const {
      persist = true,
      force = false,
      allowGpsPromotion = true,
      allowIpPromotion = false,
    } = options;
    const normalized = normalizeForState(next);
    const current = normalizeForState(locationRef.current);
    const shouldSkip =
      !force &&
      !shouldPromoteLocation(current, normalized, {
        allowGpsPromotion,
        allowIpPromotion,
      });

    if (shouldSkip) {
      return current;
    }

    if (!isSameLocation(normalized, current) || normalized?.source !== current?.source) {
      setLocationState(normalized);
    }
    const persisted = persist
      ? setLocationCookieClient({
          ...next,
          updatedAt: Number.isFinite(Number(next?.updatedAt)) ? Number(next.updatedAt) : Date.now(),
        })
      : null;
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(LOCATION_CHANGED_EVENT, {
          detail: normalizeForState(persisted || normalized),
        })
      );
    }
    return normalized;
  }, []);

  const refreshIpLocation = useCallback(async (options = {}) => {
    const { allowPromotion = false, persist = allowPromotion } = options;
    try {
      const res = await fetch("/api/location/ip", { cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json();
      const rawCity = typeof data?.city === "string" ? data.city : null;
      const city = decodeHumanLocationString(rawCity);
      const region = decodeHumanLocationString(data?.region);
      const country = decodeHumanLocationString(data?.country);
      const lat = Number.isFinite(Number(data?.lat)) ? Number(data.lat) : null;
      const lng = Number.isFinite(Number(data?.lng)) ? Number(data.lng) : null;
      if (!city && !region && !country && lat == null && lng == null) return null;
      const next = {
        source: "ip",
        city: city || null,
        region: region || null,
        country: country || null,
        lat,
        lng,
        label: buildLabel(city || null, region || null),
        updatedAt: Date.now(),
      };
      const resolved = applyLocation(next, {
        persist,
        allowIpPromotion: allowPromotion,
      });
      logBootstrap("branch=ip", {
        rawCity,
        city: resolved?.city || next.city,
        region: resolved?.region || next.region,
        country: resolved?.country || next.country,
        promoted: Boolean(allowPromotion),
      });
      return resolved;
    } catch {
      logBootstrap("branch=ip_error");
      return null;
    }
  }, [applyLocation]);

  const requestGpsLocation = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return null;

    const next = await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos?.coords?.latitude;
          const lng = pos?.coords?.longitude;
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            resolve(null);
            return;
          }

          const existing = normalizeForState(locationRef.current);
          let city = existing.city || null;
          let region = existing.region || null;
          let country = existing.country || null;

          try {
            const geocodeRes = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
            if (geocodeRes.ok) {
              const geocode = await geocodeRes.json();
              const reverseCity = String(geocode?.city || "").trim();
              const reverseRegion = String(geocode?.region || "").trim();
              if (reverseCity) city = reverseCity;
              if (reverseRegion) region = reverseRegion;
            }
          } catch {
            // Best effort reverse geocode.
          }

          resolve({
            source: "gps",
            city,
            region,
            country,
            lat,
            lng,
            label: buildLabel(city, region),
            updatedAt: Date.now(),
          });
        },
        () => resolve(null),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    });

    if (!next) return null;
    return applyLocation(next, { allowGpsPromotion: true });
  }, [applyLocation]);

  const setLocation = useCallback(
    (next) => {
      const normalized = normalizeForState(next);
      const source =
        next?.source === "ip" ||
        next?.source === "gps" ||
        next?.source === "manual" ||
        next?.source === "default"
          ? next.source
          : "manual";
      const resolved = applyLocation({
        ...normalized,
        source,
        label: normalized.label || buildLabel(normalized.city, normalized.region),
        updatedAt: Date.now(),
      });
      if (source === "manual") {
        setUserSetFlagClient(Boolean(resolved?.city));
      }
      return resolved;
    },
    [applyLocation]
  );

  const setManualLocation = useCallback(
    (next) => setLocation({ ...next, source: "manual" }),
    [setLocation]
  );

  const clearLocation = useCallback(() => {
    setLocation({});
  }, [setLocation]);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      const stored = readLocationClient();
      const hasStoredManual = stored?.source === "manual" && Boolean(stored?.city);
      const initial = normalizeForState(
        getInitialLaunchLocation(stored || initialLocation || null)
      );

      if (!cancelled) {
        const current = normalizeForState(locationRef.current);
        if (!isSameLocation(initial, current) || initial?.source !== current?.source) {
          setLocationState(initial);
        }
      }

      if (hasStoredManual) {
        setUserSetFlagClient(true);
      }

      if (stored && isFresh(stored)) {
        logBootstrap(`branch=stored_${stored.source || "unknown"}`, {
          city: stored.city,
          source: stored.source,
        });
      } else {
        logBootstrap("branch=launch_default", {
          city: initial?.city,
          source: initial?.source,
        });
      }
      if (!cancelled) {
        setHydrated(true);
      }
    };
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [initialLocation]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onLocationChanged = (event) => {
      const detail = normalizeForState(event?.detail || {});
      if (!isSameLocation(detail, locationRef.current)) {
        setLocationState(detail);
      }
    };
    window.addEventListener(LOCATION_CHANGED_EVENT, onLocationChanged);
    return () => window.removeEventListener(LOCATION_CHANGED_EVENT, onLocationChanged);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onStorage = (event) => {
      if (event.key !== LOCATION_STORAGE_KEY) return;
      const normalized = normalizeForState(getInitialLaunchLocation(readLocationClient() || null));
      if (!isSameLocation(normalized, locationRef.current)) {
        setLocationState(normalized);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(
    () => ({
      location,
      hydrated,
      hasLocation: hasLocation(location),
      setLocation,
      setManualLocation,
      clearLocation,
      refreshIpLocation,
      requestGpsLocation,
    }),
    [location, hydrated, setLocation, setManualLocation, clearLocation, refreshIpLocation, requestGpsLocation]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error("useLocation must be used within LocationProvider");
  }
  return ctx;
}
