import { NextResponse } from "next/server";

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 6;

const parseContext = (feature) => {
  const context = {};
  const parts = Array.isArray(feature?.context) ? feature.context : [];
  for (const item of parts) {
    if (!item?.id || !item?.text) continue;
    if (item.id.startsWith("place.")) {
      context.city = item.text;
    } else if (item.id.startsWith("region.")) {
      context.region = item.text;
    } else if (item.id.startsWith("postcode.")) {
      context.postcode = item.text;
    } else if (item.id.startsWith("country.")) {
      context.country = item.text;
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
      return {
        id: feature.id || feature.place_name,
        place_id: feature.id || feature.place_name,
        kind,
        label: feature.place_name || feature.text || "",
        center: {
          lng: Array.isArray(feature.center) ? feature.center[0] : null,
          lat: Array.isArray(feature.center) ? feature.center[1] : null,
        },
        bbox: feature.bbox || undefined,
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
