// lib/supabaseClient.js
import { createBrowserClient } from "@supabase/ssr";

let supabase = null;

export function getCookieName() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return undefined;
  return `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
}

export function resetSupabaseClient() {
  console.log("Resetting Supabase client singleton");
  supabase = null;
}

export function getBrowserSupabaseClient() {
  if (typeof window === "undefined") return null;

  if (!supabase) {
    try {
      supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
    } catch (err) {
      console.error("Failed to initialize Supabase browser client", err);
      return null;
    }
  }

  return supabase;
}

export function getFreshBrowserSupabaseClient() {
  resetSupabaseClient();
  return getBrowserSupabaseClient();
}
