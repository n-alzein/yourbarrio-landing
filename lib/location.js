const ZIP_REGEX = /\b\d{5}(?:-\d{4})?\b/;

export const LOCATION_STORAGE_KEY = "yb-location";
export const LEGACY_CITY_KEY = "yb-city";
export const LOCATION_COOKIE_NAME = "yb-location";

const compactSpaces = (value) => (value || "").replace(/\s+/g, " ").trim();

export const normalizeLocationInput = (value) => {
  const compacted = compactSpaces(value);
  if (!compacted) {
    return { city: null, zip: null };
  }
  const zipMatch = compacted.match(ZIP_REGEX);
  if (zipMatch) {
    return { city: null, zip: zipMatch[0] };
  }
  return { city: compacted, zip: null };
};

const normalizeNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const normalizeLocation = (location = {}) => {
  const rawCity = compactSpaces(location.city);
  const rawZip = compactSpaces(location.zip);
  const zip = rawZip || null;
  const city = zip ? null : rawCity || null;
  const lat = normalizeNumber(location.lat);
  const lng = normalizeNumber(location.lng);
  const label = compactSpaces(location.label) || null;
  const place_id = compactSpaces(location.place_id) || null;
  const kind = location.kind === "postcode" || location.kind === "place" ? location.kind : null;
  return {
    city,
    zip,
    lat,
    lng,
    label,
    place_id,
    kind,
  };
};

export const hasLocation = (location) =>
  Boolean(location?.zip || location?.city);

export const isSameLocation = (a, b) => {
  const left = normalizeLocation(a);
  const right = normalizeLocation(b);
  return (
    left.city === right.city &&
    left.zip === right.zip &&
    left.lat === right.lat &&
    left.lng === right.lng
  );
};

export const getLocationLabel = (location) =>
  location?.label || location?.zip || location?.city || "Your city";

export const normalizeSelectedLocation = (suggestion) => {
  if (!suggestion) return normalizeLocation({});
  const kind = suggestion.kind === "postcode" ? "postcode" : "place";
  const context = suggestion.context || {};
  let city = null;
  let zip = null;
  if (kind === "postcode") {
    zip =
      compactSpaces(context.postcode) ||
      (typeof suggestion.label === "string" ? suggestion.label.match(ZIP_REGEX)?.[0] : null) ||
      null;
  } else {
    city =
      compactSpaces(context.city) ||
      compactSpaces((suggestion.label || "").split(",")[0]) ||
      null;
  }
  const center = suggestion.center || {};
  const lat = normalizeNumber(center.lat);
  const lng = normalizeNumber(center.lng);
  return normalizeLocation({
    city,
    zip,
    lat,
    lng,
    label: suggestion.label,
    place_id: suggestion.place_id || suggestion.id,
    kind,
  });
};

export const getLocationFromSearchParams = (params) => {
  if (!params?.get) {
    return normalizeLocation({});
  }
  const city = params.get("city") || "";
  const zip = params.get("zip") || "";
  return normalizeLocation({ city, zip });
};

export const setLocationSearchParams = (params, location) => {
  const next = new URLSearchParams(
    typeof params?.toString === "function" ? params.toString() : params || ""
  );
  const normalized = normalizeLocation(location);
  if (normalized.zip) {
    next.set("zip", normalized.zip);
    next.delete("city");
  } else if (normalized.city) {
    next.set("city", normalized.city);
    next.delete("zip");
  } else {
    next.delete("city");
    next.delete("zip");
  }
  return next;
};

export const withLocationHref = (href, location) => {
  const [path, query = ""] = (href || "").split("?");
  const params = setLocationSearchParams(new URLSearchParams(query), location);
  const next = params.toString();
  return next ? `${path}?${next}` : path;
};
