import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildBusinessGeocodeAddress,
  geocodeBusinessAddress,
  normalizeCoordinates,
} from "@/lib/location/businessGeocoding";

const AUTH_TOKEN = process.env.ADMIN_GEOCODE_TOKEN || "";

const BATCH_LIMIT =
  Number.parseInt(process.env.GEOCODE_BATCH_LIMIT || "", 10) || 15;

const hasCoords = (row) => {
  return Boolean(normalizeCoordinates(row));
};

const buildAddress = (row) => {
  return buildBusinessGeocodeAddress(row);
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

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase service key not configured" },
      { status: 500 }
    );
  }

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
      const coords = await geocodeBusinessAddress(addr);
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
