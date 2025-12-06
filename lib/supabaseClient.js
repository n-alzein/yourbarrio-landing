// lib/supabaseClient.js
console.log("🔥 Supabase client module loaded");

import { createClient } from "@supabase/supabase-js";

let supabase = null;

export function getBrowserSupabaseClient() {
  if (typeof window === "undefined") return null;

  console.log("ENV URL =", process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log("ENV KEY =", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!supabase) {
    console.log("⚡ Creating new Supabase browser client…");

    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          flowType: "pkce",
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      }
    );
  }

  return supabase;
}
