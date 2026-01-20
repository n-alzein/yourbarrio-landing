import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const CACHE_SECONDS = 120;
const GEOCODE_KEY = process.env.MAPBOX_GEOCODING_TOKEN || process.env.GOOGLE_GEOCODING_API_KEY || "";

function createSupabaseClient() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Missing Supabase configuration");
  }
  return supabase;
}

const geocodeCache = new Map();

async function geocodeAddress(address) {
  if (!address || !GEOCODE_KEY) return null;
  const key = address.toLowerCase().trim();
  if (geocodeCache.has(key)) return geocodeCache.get(key);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    address
  )}.json?limit=1&access_token=${GEOCODE_KEY}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`geocode ${res.status}`);
    const data = await res.json();
    const center = data?.features?.[0]?.center;
    if (Array.isArray(center) && center.length >= 2 && typeof center[0] === "number" && typeof center[1] === "number") {
      const coords = { lng: center[0], lat: center[1] };
      geocodeCache.set(key, coords);
      return coords;
    }
  } catch (err) {
    console.warn("geocode failed", address, err?.message || err);
  }
  geocodeCache.set(key, null);
  return null;
}

async function fetchBusinesses(supabase) {
  const businessesResult = await supabase
    .from("businesses")
    .select("*")
    .limit(400);
  if (businessesResult.error) {
    console.warn("public-businesses: businesses query failed", businessesResult.error);
    return [];
  }
  return (businessesResult.data || []).map((row) => ({ ...row, _table: "businesses" }));
}

async function fetchUsers(supabase) {
  const usersResult = await supabase
    .from("users")
    .select("*")
    .eq("role", "business")
    .limit(400);
  if (usersResult.error) {
    console.warn("public-businesses: users query failed", usersResult.error);
    return [];
  }
  return (usersResult.data || []).map((row) => ({ ...row, _table: "users" }));
}

export async function GET() {
  try {
    const supabase = createSupabaseClient();

    const [businesses, users] = await Promise.all([fetchBusinesses(supabase), fetchUsers(supabase)]);

    const combined = [...businesses, ...users];
    const deduped = [];
    const seen = new Set();
    for (const row of combined) {
      const key = row.id;
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      deduped.push(row);
    }

    const parseNum = (val) => {
      if (typeof val === "number" && Number.isFinite(val)) return val;
      const parsed = parseFloat(val);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const withCoords = await Promise.all(
      deduped.map(async (row, idx) => {
        const lat = parseNum(row.latitude ?? row.lat);
        const lng = parseNum(row.longitude ?? row.lng);
        const hasCoords =
          typeof lat === "number" &&
          typeof lng === "number" &&
          lat !== 0 &&
          lng !== 0;

        if (hasCoords) {
          return {
            ...row,
            latitude: lat,
            longitude: lng,
            lat,
            lng,
          };
        }

        const addressParts = [row.address, row.city, row.state, row.country]
          .filter(Boolean)
          .join(", ");

        let coords = null;
        if (GEOCODE_KEY) {
          coords = await geocodeAddress(addressParts);
          if (coords) {
            try {
              const payload = {
                latitude: coords.lat,
                longitude: coords.lng,
                lat: coords.lat,
                lng: coords.lng,
              };
              if (row._table === "businesses") {
                await supabase.from("businesses").update(payload).eq("id", row.id);
              } else if (row._table === "users") {
                await supabase.from("users").update(payload).eq("id", row.id);
              }
            } catch (updateErr) {
              console.warn("Failed to persist geocode coords", row.id, updateErr);
            }
          }
        }

        if (coords) {
          return {
            ...row,
            latitude: coords.lat,
            longitude: coords.lng,
            lat: coords.lat,
            lng: coords.lng,
          };
        }

        return {
          ...row,
          latitude: null,
          longitude: null,
          lat: null,
          lng: null,
        };
      })
    );

    const resp = NextResponse.json({ businesses: withCoords }, {
      headers: {
        "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`,
      },
    });
    return resp;
  } catch (err) {
    console.warn("public-businesses endpoint error", err);
    return NextResponse.json({ businesses: [], error: "Failed to load businesses" }, { status: 200 });
  }
}
