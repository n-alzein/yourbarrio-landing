function trimText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeCoordinates(source) {
  const lat = parseCoordinate(
    source?.latitude ?? source?.lat ?? source?.location_lat ?? source?.center?.lat
  );
  const lng = parseCoordinate(
    source?.longitude ?? source?.lng ?? source?.location_lng ?? source?.center?.lng
  );
  if (lat === null || lng === null) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

export function buildBusinessGeocodeAddress({
  address,
  address_2,
  city,
  state,
  postal_code,
  country,
}) {
  return [address, address_2, city, state, postal_code, country]
    .map(trimText)
    .filter(Boolean)
    .join(", ");
}

export async function geocodeBusinessAddress(
  address,
  {
    fetchImpl = fetch,
    accessToken = process.env.MAPBOX_GEOCODING_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "",
  } = {}
) {
  const query = trimText(address);
  if (!query || !accessToken) return null;

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
    `?limit=1&types=address,place,postcode,locality,neighborhood&access_token=${accessToken}`;

  const response = await fetchImpl(url, {
    headers: {
      "User-Agent": "yourbarrio-business-geocoder/1.0",
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Mapbox geocoding failed (${response.status}) ${detail}`.trim());
  }

  const payload = await response.json();
  const center = payload?.features?.[0]?.center;
  if (!Array.isArray(center) || center.length < 2) return null;

  const lng = parseCoordinate(center[0]);
  const lat = parseCoordinate(center[1]);
  if (lat === null || lng === null) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

export async function resolveBusinessCoordinates({
  nextLocation,
  previousLocation,
  fetchImpl = fetch,
  logger = console,
} = {}) {
  const address = buildBusinessGeocodeAddress(nextLocation || {});
  if (!address) {
    return { coords: null, source: "missing_address" };
  }

  try {
    const geocoded = await geocodeBusinessAddress(address, { fetchImpl });
    if (geocoded) {
      return { coords: geocoded, source: "geocoded" };
    }
  } catch (error) {
    logger?.error?.("[business-geocoding] geocode failed", {
      address,
      message: error?.message || String(error),
    });
  }

  const existing = normalizeCoordinates(previousLocation);
  if (existing) {
    return { coords: existing, source: "preserved_existing" };
  }

  return { coords: null, source: "unavailable" };
}
