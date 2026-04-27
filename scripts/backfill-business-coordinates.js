import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import {
  buildBusinessGeocodeAddress,
  geocodeBusinessAddress,
  normalizeCoordinates,
} from "../lib/location/businessGeocoding.js";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) continue;
    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: businesses, error } = await supabase
    .from("businesses")
    .select(
      "id,owner_user_id,address,address_2,city,state,postal_code,latitude,longitude"
    )
    .or("latitude.is.null,longitude.is.null")
    .limit(500);

  if (error) throw error;

  for (const business of businesses || []) {
    if (normalizeCoordinates(business)) continue;

    const address = buildBusinessGeocodeAddress(business);
    if (!address) {
      console.warn(`[skip] ${business.owner_user_id}: missing address`);
      continue;
    }

    try {
      const coords = await geocodeBusinessAddress(address);
      if (!coords) {
        console.warn(`[skip] ${business.owner_user_id}: no geocode result`);
        continue;
      }

      const payload = { latitude: coords.lat, longitude: coords.lng };
      const [businessUpdate, userUpdate] = await Promise.all([
        supabase.from("businesses").update(payload).eq("id", business.id),
        supabase.from("users").update(payload).eq("id", business.owner_user_id),
      ]);

      if (businessUpdate.error) {
        console.error(
          `[error] ${business.owner_user_id}: ${businessUpdate.error.message || "business update failed"}`
        );
        continue;
      }

      if (userUpdate.error) {
        console.error(
          `[warn] ${business.owner_user_id}: business updated but user sync failed: ${userUpdate.error.message || "user update failed"}`
        );
      }

      console.log(`[updated] ${business.owner_user_id}: ${coords.lat},${coords.lng}`);
    } catch (errorCaught) {
      console.error(
        `[error] ${business.owner_user_id}: ${errorCaught?.message || String(errorCaught)}`
      );
    }
  }

  console.log("Business coordinate backfill complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
