// scripts/backfill-user-coords.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // server key
const MAPBOX_TOKEN = process.env.MAPBOX_GEOCODING_TOKEN;

if (!SUPABASE_URL || !SERVICE_KEY || !MAPBOX_TOKEN) {
  throw new Error("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or MAPBOX_GEOCODING_TOKEN");
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const geocode = async (line) => {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(line)}.json?limit=1&access_token=${MAPBOX_TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mapbox ${res.status}`);
  const data = await res.json();
  const center = data?.features?.[0]?.center;
  return Array.isArray(center) && center.length >= 2 ? { lng: center[0], lat: center[1] } : null;
};

(async () => {
  // pull users missing coords
  const { data: users, error } = await supabase
    .from("users")
    .select("id,address,city,latitude,longitude")
    .is("latitude", null)
    .limit(500);
  if (error) throw error;

  for (const u of users) {
    const line = [u.address, u.city].filter(Boolean).join(", ");
    if (!line) continue;
    const coords = await geocode(line);
    if (!coords) continue;
    await supabase.from("users").update({ latitude: coords.lat, longitude: coords.lng }).eq("id", u.id);
    console.log(`Updated ${u.id}: ${coords.lat},${coords.lng}`);
  }

  console.log("Done");
})();
