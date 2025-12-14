import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const AUTH_TOKEN = process.env.ADMIN_GEOCODE_TOKEN || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const GEOCODE_KEY = process.env.GOOGLE_GEOCODING_API_KEY || "";

const BATCH_LIMIT =
  Number.parseInt(process.env.GEOCODE_BATCH_LIMIT || "", 10) || 15;

const hasCoords = (row) => {
  const lat =
    typeof row?.latitude === "number"
      ? row.latitude
      : typeof row?.lat === "number"
        ? row.lat
        : null;
  const lng =
    typeof row?.longitude === "number"
      ? row.longitude
      : typeof row?.lng === "number"
        ? row.lng
        : null;
  if (lat === null || lng === null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
};

const geocodeAddress = async (address) => {
  if (!address) return null;
  if (!GEOCODE_KEY) throw new Error("Missing GOOGLE_GEOCODING_API_KEY");
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address
  )}&key=${GEOCODE_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Geocode failed ${res.status} ${txt}`);
  }
  const data = await res.json();
  if (!data || data.status !== "OK" || !data.results?.length) return null;
  const loc = data.results[0]?.geometry?.location;
  if (typeof loc?.lat === "number" && typeof loc?.lng === "number") {
    if (loc.lat === 0 && loc.lng === 0) return null;
    return { lat: loc.lat, lng: loc.lng };
  }
  return null;
};

const buildAddress = (row) => {
  const parts = [];
  if (row.address) parts.push(row.address);
  if (row.city) parts.push(row.city);
  if (row.state) parts.push(row.state);
  if (row.country) parts.push(row.country);
  return parts.filter(Boolean).join(", ");
};

export async function POST(request) {
  if (!AUTH_TOKEN) {
    return NextResponse.json(
      { error: "ADMIN_GEOCODE_TOKEN missing on server" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization") || "";
  if (authHeader !== `Bearer ${AUTH_TOKEN}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json(
      { error: "Supabase service key not configured" },
      { status: 500 }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // pull candidates from both tables
  const [bizResult, userResult] = await Promise.all([
    supabase
      .from("businesses")
      .select(
        "id,address,city,state,country,latitude,longitude,lat,lng"
      )
      .or("latitude.is.null,longitude.is.null,lat.is.null,lng.is.null")
      .limit(BATCH_LIMIT),
    supabase
      .from("users")
      .select(
        "id,address,city,state,country,latitude,longitude,lat,lng,role"
      )
      .eq("role", "business")
      .or("latitude.is.null,longitude.is.null,lat.is.null,lng.is.null")
      .limit(BATCH_LIMIT),
  ]);

  const candidates = [];
  if (!bizResult.error) {
    bizResult.data
      .filter((row) => !hasCoords(row))
      .forEach((row) => candidates.push({ table: "businesses", row }));
  }
  if (!userResult.error) {
    userResult.data
      .filter((row) => !hasCoords(row))
      .forEach((row) => candidates.push({ table: "users", row }));
  }

  const slice = candidates.slice(0, BATCH_LIMIT);
  const updates = [];
  const errors = [];

  for (const item of slice) {
    const addr = buildAddress(item.row);
    if (!addr) {
      errors.push({ id: item.row.id, table: item.table, error: "no address" });
      continue;
    }
    try {
      const coords = await geocodeAddress(addr);
      if (!coords) {
        errors.push({ id: item.row.id, table: item.table, error: "no result" });
        continue;
      }
      const payload = {
        latitude: coords.lat,
        longitude: coords.lng,
        lat: coords.lat,
        lng: coords.lng,
      };
      const { error } = await supabase
        .from(item.table)
        .update(payload)
        .eq("id", item.row.id);
      if (error) {
        errors.push({ id: item.row.id, table: item.table, error: error.message });
      } else {
        updates.push({ id: item.row.id, table: item.table, coords });
      }
    } catch (err) {
      errors.push({
        id: item.row.id,
        table: item.table,
        error: err?.message || String(err),
      });
    }
  }

  return NextResponse.json({
    attempted: slice.length,
    updated: updates.length,
    errors,
    processed: updates,
  });
}
