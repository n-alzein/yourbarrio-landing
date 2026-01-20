import "server-only";

import { createClient } from "@supabase/supabase-js";

let serverClient = null;

function ensureServerEnv() {
  const missing = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  if (missing.length && process.env.NODE_ENV !== "production") {
    throw new Error(`Missing Supabase env: ${missing.join(", ")}`);
  }
  return missing.length === 0;
}

export function getSupabaseServerClient() {
  const hasEnv = ensureServerEnv();
  if (!hasEnv) return null;
  if (serverClient) return serverClient;
  serverClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
  return serverClient;
}
