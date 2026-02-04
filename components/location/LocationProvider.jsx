"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LOCATION_COOKIE_NAME,
  LOCATION_STORAGE_KEY,
  LEGACY_CITY_KEY,
  getLocationFromSearchParams,
  hasLocation,
  isSameLocation,
  normalizeLocation,
  setLocationSearchParams,
} from "@/lib/location";

const LocationContext = createContext(null);

const readCookie = (name) => {
  if (typeof document === "undefined") return null;
  const escaped = name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
};

const writeCookie = (name, value) => {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
};

const clearCookie = (name) => {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
};

const readStoredLocation = () => {
  if (typeof window === "undefined") return null;
  try {
    const cookieValue = readCookie(LOCATION_COOKIE_NAME);
    if (cookieValue) {
      return normalizeLocation(JSON.parse(cookieValue));
    }
  } catch {
    /* ignore cookie parse */
  }
  try {
    const raw = window.localStorage.getItem(LOCATION_STORAGE_KEY);
    if (raw) {
      return normalizeLocation(JSON.parse(raw));
    }
  } catch {
    /* ignore storage parse */
  }
  try {
    const legacyCity = window.localStorage.getItem(LEGACY_CITY_KEY);
    if (legacyCity) {
      return normalizeLocation({ city: legacyCity });
    }
  } catch {
    /* ignore legacy */
  }
  return null;
};

const persistLocation = (location) => {
  if (typeof window === "undefined") return;
  const normalized = normalizeLocation(location);
  if (!hasLocation(normalized)) {
    try {
      window.localStorage.removeItem(LOCATION_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_CITY_KEY);
    } catch {
      /* ignore storage */
    }
    clearCookie(LOCATION_COOKIE_NAME);
    return;
  }
  const payload = JSON.stringify(normalized);
  try {
    window.localStorage.setItem(LOCATION_STORAGE_KEY, payload);
    if (normalized.city) {
      window.localStorage.setItem(LEGACY_CITY_KEY, normalized.city);
    } else {
      window.localStorage.removeItem(LEGACY_CITY_KEY);
    }
  } catch {
    /* ignore storage */
  }
  writeCookie(LOCATION_COOKIE_NAME, payload);
};

export function LocationProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [location, setLocationState] = useState(() => normalizeLocation({}));
  const [hydrated, setHydrated] = useState(false);
  const locationRef = useRef(location);
  const didInitRef = useRef(false);
  const lastUrlRef = useRef("");

  // Keep URL in sync and hydrate from URL -> cookie/localStorage.
  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  const syncUrl = useCallback(
    (next, replace = false) => {
      if (!pathname) return;
      const params = setLocationSearchParams(searchParams, next);
      const query = params.toString();
      const nextUrl = query ? `${pathname}?${query}` : pathname;
      if (nextUrl === lastUrlRef.current) return;
      lastUrlRef.current = nextUrl;
      if (replace) {
        router.replace(nextUrl);
      } else {
        router.push(nextUrl);
      }
    },
    [pathname, router, searchParams]
  );

  const setLocation = useCallback(
    (next, options = {}) => {
      const normalized = normalizeLocation(next);
      if (!isSameLocation(normalized, locationRef.current)) {
        setLocationState(normalized);
      }
      persistLocation(normalized);
      syncUrl(normalized, options.replace === true);
    },
    [syncUrl]
  );

  const clearLocation = useCallback(() => {
    setLocation({ city: null, zip: null, lat: null, lng: null });
  }, [setLocation]);

  useEffect(() => {
    const scheduled = new Set();
    const schedule = (fn) => {
      const id = setTimeout(fn, 0);
      scheduled.add(id);
    };
    const clearScheduled = () => {
      scheduled.forEach((id) => clearTimeout(id));
      scheduled.clear();
    };
    const urlLocation = getLocationFromSearchParams(searchParams);
    if (hasLocation(urlLocation)) {
      if (!isSameLocation(urlLocation, locationRef.current)) {
        schedule(() => setLocationState(urlLocation));
      }
      persistLocation(urlLocation);
      didInitRef.current = true;
      schedule(() => setHydrated(true));
      return clearScheduled;
    }

    if (!didInitRef.current) {
      const stored = readStoredLocation();
      if (stored && hasLocation(stored)) {
        schedule(() => setLocationState(stored));
        persistLocation(stored);
        syncUrl(stored, true);
      }
      didInitRef.current = true;
      schedule(() => setHydrated(true));
      return clearScheduled;
    }

    if (hasLocation(locationRef.current)) {
      syncUrl(locationRef.current, true);
    }
    schedule(() => setHydrated(true));
    return clearScheduled;
  }, [searchParams, syncUrl]);

  useEffect(() => {
    if (!hydrated || hasLocation(locationRef.current)) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (cancelled || hasLocation(locationRef.current)) return;
        const lat = pos?.coords?.latitude;
        const lng = pos?.coords?.longitude;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        try {
          const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
          if (!res.ok) return;
          const data = await res.json();
          const city = (data?.city || "").trim();
          if (city && !cancelled && !hasLocation(locationRef.current)) {
            setLocation({ city, lat, lng }, { replace: true });
          }
        } catch {
          /* best effort */
        }
      },
      () => {
        /* ignore geolocation errors */
      },
      { timeout: 8000 }
    );
    return () => {
      cancelled = true;
    };
  }, [hydrated, setLocation]);

  const value = useMemo(
    () => ({
      location,
      hydrated,
      hasLocation: hasLocation(location),
      setLocation,
      clearLocation,
    }),
    [location, hydrated, setLocation, clearLocation]
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
