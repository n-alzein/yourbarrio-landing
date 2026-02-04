import { NextResponse } from "next/server";

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 6;
const ZIP_REGEX = /\b\d{5}(?:-\d{4})?\b/;

const compactSpaces = (value) => (value || "").replace(/\s+/g, " ").trim();

const extractCityFromLabel = (label) => {
  if (typeof label !== "string") return "";
  const withoutZip = label.replace(ZIP_REGEX, "");
  const normalized = withoutZip.replace(/[-\u2014]/g, ",");
  const parts = normalized
    .split(",")
    .map((part) => compactSpaces(part))
    .filter(Boolean);
  return parts[0] || "";
};

const normalizeRegionCode = (value) => {
  const compacted = compactSpaces(value).toLowerCase();
  if (!compacted) return "";
  const parts = compacted.split("-");
  const tail = parts[parts.length - 1] || "";
  return tail ? tail.toUpperCase() : "";
};

const parseContext = (feature) => {
  const context = {};
  const parts = Array.isArray(feature?.context) ? feature.context : [];
  for (const item of parts) {
    if (!item?.id || !item?.text) continue;
    if (item.id.startsWith("place.")) {
      context.city = item.text;
    } else if (item.id.startsWith("region.")) {
      context.region = item.text;
      if (item.short_code) context.region_code = item.short_code;
    } else if (item.id.startsWith("postcode.")) {
      context.postcode = item.text;
    } else if (item.id.startsWith("country.")) {
      context.country = item.text;
      if (item.short_code) context.country_code = item.short_code;
    }
  }
  if (!context.postcode && feature?.place_type?.includes("postcode")) {
    context.postcode = feature?.text || "";
  }
  if (!context.city && feature?.place_type?.includes("place")) {
    context.city = feature?.text || "";
  }
  return context;
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim();
  const debugEnabled =
    searchParams.get("debug") === "1" && process.env.NODE_ENV !== "production";
  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ suggestions: [] });
  }

  const token =
    process.env.MAPBOX_GEOCODING_TOKEN ||
    process.env.MAPBOX_TOKEN ||
    process.env.MAPBOX_ACCESS_TOKEN ||
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
    "";
  const usedTokenVar = process.env.MAPBOX_GEOCODING_TOKEN
    ? "MAPBOX_GEOCODING_TOKEN"
    : process.env.MAPBOX_TOKEN
    ? "MAPBOX_TOKEN"
    : process.env.MAPBOX_ACCESS_TOKEN
    ? "MAPBOX_ACCESS_TOKEN"
    : process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    ? "NEXT_PUBLIC_MAPBOX_TOKEN"
    : "none";
  if (!token) {
    return NextResponse.json(
      {
        suggestions: [],
        error: "missing_mapbox_token",
        ...(debugEnabled ? { node_env: process.env.NODE_ENV } : {}),
      },
      { status: 500 }
    );
  }

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("autocomplete", "true");
  url.searchParams.set("types", "place,postcode");
  url.searchParams.set("country", "us");
  url.searchParams.set("limit", String(MAX_RESULTS));

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        {
          suggestions: [],
          error: "mapbox_error",
          status: res.status,
          ...(debugEnabled
            ? {
                errText: errText ? errText.slice(0, 200) : "",
                request_url: url.toString().replace(token, "<token>"),
                usedTokenVar,
              }
            : {}),
        },
        { status: 502 }
      );
    }
    const payload = await res.json();
    const suggestions = (payload?.features || []).map((feature) => {
      const kind = feature?.place_type?.includes("postcode") ? "postcode" : "place";
      const context = parseContext(feature);
      const label = feature.place_name || feature.text || "";
      const city =
        context.city ||
        (kind === "place" ? feature.text || "" : "") ||
        extractCityFromLabel(label);
      const regionCode = normalizeRegionCode(context.region_code || "");
      const state = regionCode || context.region || "";
      return {
        id: feature.id || feature.place_name,
        place_id: feature.id || feature.place_name,
        kind,
        label,
        center: {
          lng: Array.isArray(feature.center) ? feature.center[0] : null,
          lat: Array.isArray(feature.center) ? feature.center[1] : null,
        },
        bbox: feature.bbox || undefined,
        city,
        state: state || undefined,
        region: context.region || undefined,
        region_code: context.region_code || undefined,
        country: context.country || undefined,
        country_code: context.country_code || undefined,
        postcode: context.postcode || undefined,
        zip: context.postcode || undefined,
        context,
      };
    });
    return NextResponse.json({
      suggestions,
      ...(debugEnabled
        ? {
            debug: {
              featureCount: Array.isArray(payload?.features) ? payload.features.length : 0,
              query,
              types: "place,postcode",
              country: "us",
              usedTokenVar,
            },
          }
        : {}),
    });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
