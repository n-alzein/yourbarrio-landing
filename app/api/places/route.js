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
  process.env.NEXT_PUBLIC_DISABLE_PLACES === "1";

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

const normalizeCategoryType = (value) =>
  (value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const titleCase = (value) =>
  (value || "")
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const normalizeFeature = (feature) => {
  if (!feature) return null;
  const center = Array.isArray(feature.center) ? feature.center : [];
  const [lng, lat] = center;
  const rawCategories = feature.properties?.category || "";
  const categoryParts = rawCategories
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const types = categoryParts.map(normalizeCategoryType).filter(Boolean);
  const categoryLabel = categoryParts.length ? titleCase(categoryParts[0]) : undefined;

  return {
    id: feature.id,
    displayName: feature.text ? { text: feature.text } : undefined,
    formattedAddress: feature.place_name || "",
    location:
      typeof lat === "number" && typeof lng === "number"
        ? { latitude: lat, longitude: lng }
        : null,
    types,
    categoryLabel,
    source: "mapbox",
    photos: [],
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

const getMapboxToken = () =>
  process.env.MAPBOX_GEOCODING_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const toBBox = (lat, lng, radiusMeters) => {
  const safeRadius = Math.max(100, Math.min(radiusMeters || 1000, 50_000));
  const latDelta = safeRadius / 111320;
  const lngDelta =
    safeRadius / (111320 * Math.cos((lat * Math.PI) / 180) || 1);
  const minLat = lat - latDelta;
  const maxLat = lat + latDelta;
  const minLng = lng - lngDelta;
  const maxLng = lng + lngDelta;
  return [minLng, minLat, maxLng, maxLat].join(",");
};

async function callMapboxGeocoding(endpoint, params = {}) {
  const token = getMapboxToken();
  if (!token) {
    throw new Error("Mapbox geocoding token missing");
  }
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${endpoint}.json`
  );
  url.searchParams.set("access_token", token);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  const res = await fetch(url.toString());
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`mapbox geocoding failed: ${res.status} ${txt}`);
  }
  return res.json();
}

async function handleNearby({ lat, lng, radiusMeters, maxResultCount, query }) {
  if (typeof lat !== "number" || typeof lng !== "number") {
    return { error: "lat/lng required" };
  }

  const limit = Math.max(1, Math.min(maxResultCount || 10, 20));
  const searchQuery = query && String(query).trim().length ? String(query).trim() : "store";
  const data = await callMapboxGeocoding(searchQuery, {
    types: "poi",
    limit,
    proximity: `${lng},${lat}`,
    bbox: toBBox(lat, lng, radiusMeters),
  });
  const places = Array.isArray(data?.features)
    ? data.features.map(normalizeFeature).filter(Boolean)
    : [];

  return { places, source: "mapbox" };
}

async function handleTextSearch({ textQuery, locationBias, maxResultCount }) {
  if (!textQuery) {
    return { places: [] };
  }

  const limit = Math.max(1, Math.min(maxResultCount || 5, 20));
  const params = {
    types: "poi",
    limit,
    autocomplete: "true",
  };
  if (
    locationBias &&
    typeof locationBias?.lat === "number" &&
    typeof locationBias?.lng === "number"
  ) {
    params.proximity = `${locationBias.lng},${locationBias.lat}`;
    if (locationBias.radiusMeters) {
      params.bbox = toBBox(
        locationBias.lat,
        locationBias.lng,
        locationBias.radiusMeters
      );
    }
  }

  const data = await callMapboxGeocoding(encodeURIComponent(textQuery), params);
  const places = Array.isArray(data?.features)
    ? data.features.map(normalizeFeature).filter(Boolean)
    : [];

  return { places, source: "mapbox" };
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

  try {
    const payload =
      mode === "text"
        ? await handleTextSearch({
            textQuery: body?.textQuery,
            locationBias: body?.locationBias,
            maxResultCount: body?.maxResultCount,
          })
        : await handleNearby({
            lat: body?.lat,
            lng: body?.lng,
            radiusMeters: body?.radiusMeters,
            maxResultCount: body?.maxResultCount,
            query: body?.query,
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
