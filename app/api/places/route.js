import { NextResponse } from "next/server";
import rateLimit from "@/lib/rateLimit";

const limiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
});

const CACHE_TTL_MS =
  Number.parseInt(process.env.PLACES_CACHE_TTL_MS || "", 10) || 5 * 60 * 1000;

const PLACES_MODE =
  process.env.NEXT_PUBLIC_PLACES_MODE || process.env.PLACES_MODE || "prod";

const PLACES_DISABLED =
  process.env.NEXT_PUBLIC_DISABLE_PLACES === "true" ||
  process.env.NEXT_PUBLIC_DISABLE_PLACES === "1" ||
  (process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_DISABLE_PLACES !== "false");

const responseCache = new Map();

const MOCK_PLACES = [
  {
    id: "mock-1",
    displayName: { text: "Demo Cafe" },
    formattedAddress: "123 Sample St, San Francisco, CA",
    location: { latitude: 37.7765, longitude: -122.4167 },
    types: ["cafe"],
    photos: [],
  },
  {
    id: "mock-2",
    displayName: { text: "Sample Bookstore" },
    formattedAddress: "456 Fiction Ave, San Francisco, CA",
    location: { latitude: 37.7725, longitude: -122.4318 },
    types: ["book_store"],
    photos: [],
  },
];

const FIELD_MASK =
  "places.id,places.displayName.text,places.formattedAddress,places.location,places.types,places.photos";

const normalizePlace = (place) => {
  if (!place) return null;
  const location =
    place.location ||
    (place.geometry?.location
      ? {
          latitude:
            typeof place.geometry.location.lat === "function"
              ? place.geometry.location.lat()
              : place.geometry.location.lat,
          longitude:
            typeof place.geometry.location.lng === "function"
              ? place.geometry.location.lng()
              : place.geometry.location.lng,
        }
      : null);

  return {
    id: place.id || place.place_id,
    displayName: place.displayName || (place.name ? { text: place.name } : undefined),
    formattedAddress: place.formattedAddress || place.formatted_address || place.vicinity || "",
    location,
    types: place.types || [],
    photos: place.photos || [],
  };
};

const getCacheKey = (payload) => {
  const { mode, textQuery, lat, lng, radiusMeters, includedTypes, locationBias, maxResultCount } =
    payload || {};
  return JSON.stringify({
    mode,
    textQuery: (textQuery || "").toLowerCase(),
    lat: typeof lat === "number" ? lat.toFixed(4) : null,
    lng: typeof lng === "number" ? lng.toFixed(4) : null,
    radius: radiusMeters ? Math.round(radiusMeters) : null,
    types: Array.isArray(includedTypes) ? [...includedTypes].sort() : [],
    bias: locationBias
      ? {
          lat: typeof locationBias.lat === "number" ? locationBias.lat.toFixed(4) : null,
          lng: typeof locationBias.lng === "number" ? locationBias.lng.toFixed(4) : null,
          r: locationBias.radiusMeters ? Math.round(locationBias.radiusMeters) : null,
        }
      : null,
    maxResultCount: maxResultCount ? Math.min(Math.max(1, maxResultCount), 20) : undefined,
  });
};

const getCachedResponse = (key) => {
  if (!key) return null;
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }
  if (cached) {
    responseCache.delete(key);
  }
  return null;
};

const setCachedResponse = (key, payload) => {
  if (!key) return;
  responseCache.set(key, {
    payload,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
};

const getClientIp = (request) => {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
};

const getPlacesApiKey = () =>
  process.env.GOOGLE_PLACES_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

async function callPlaces(endpoint, body, sessionToken) {
  const apiKey = getPlacesApiKey();
  if (!apiKey) {
    throw new Error("Places API key missing");
  }

  const res = await fetch(`https://places.googleapis.com/v1/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
      ...(sessionToken ? { "X-Goog-Session-Token": sessionToken } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${endpoint} failed: ${res.status} ${txt}`);
  }

  return res.json();
}

async function handleNearby({ lat, lng, radiusMeters, includedTypes, maxResultCount, sessionToken }) {
  if (typeof lat !== "number" || typeof lng !== "number") {
    return { error: "lat/lng required" };
  }

  const body = {
    includedTypes: Array.isArray(includedTypes) && includedTypes.length ? includedTypes : undefined,
    maxResultCount: Math.max(1, Math.min(maxResultCount || 10, 20)),
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: Math.max(100, Math.min(radiusMeters || 1000, 50_000)),
      },
    },
  };

  const data = await callPlaces("places:searchNearby", body, sessionToken);
  const places = Array.isArray(data?.places)
    ? data.places.map(normalizePlace).filter(Boolean)
    : [];

  return { places, source: "google" };
}

async function handleTextSearch({
  textQuery,
  locationBias,
  maxResultCount,
  sessionToken,
}) {
  if (!textQuery) {
    return { places: [] };
  }

  const body = {
    textQuery,
    maxResultCount: Math.max(1, Math.min(maxResultCount || 5, 20)),
    locationBias:
      locationBias && typeof locationBias?.lat === "number" && typeof locationBias?.lng === "number"
        ? {
            circle: {
              center: {
                latitude: locationBias.lat,
                longitude: locationBias.lng,
              },
              radius: Math.max(100, Math.min(locationBias.radiusMeters || 1000, 50_000)),
            },
          }
        : undefined,
  };

  const data = await callPlaces("places:searchText", body, sessionToken);
  const places = Array.isArray(data?.places)
    ? data.places.map(normalizePlace).filter(Boolean)
    : [];

  return { places, source: "google" };
}

export async function POST(request) {
  const ip = getClientIp(request);
  try {
    await limiter.check(20, `PLACES_API:${ip}`);
  } catch {
    return new Response("Too many requests", { status: 429 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const mode = body?.mode === "text" ? "text" : "nearby";
  const cacheKey = getCacheKey(body);

  if (PLACES_DISABLED || PLACES_MODE === "dev") {
    return NextResponse.json({
      places: MOCK_PLACES,
      source: PLACES_MODE === "dev" ? "mock:mode" : "mock:disable",
      disabled: true,
    });
  }

  const cached = getCachedResponse(cacheKey);
  if (cached) {
    return NextResponse.json({ ...cached, cache: true });
  }

  const sessionToken = typeof body?.sessionToken === "string" ? body.sessionToken : undefined;

  try {
    const payload =
      mode === "text"
        ? await handleTextSearch({
            textQuery: body?.textQuery,
            locationBias: body?.locationBias,
            maxResultCount: body?.maxResultCount,
            sessionToken,
          })
        : await handleNearby({
            lat: body?.lat,
            lng: body?.lng,
            radiusMeters: body?.radiusMeters,
            includedTypes: body?.includedTypes,
            maxResultCount: body?.maxResultCount,
            sessionToken,
          });

    if (payload?.error) {
      return NextResponse.json(payload, { status: 400 });
    }

    setCachedResponse(cacheKey, payload);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("Places API failure", err);
    return NextResponse.json(
      { error: "places_failed", message: err?.message || "Places lookup failed" },
      { status: 502 }
    );
  }
}
