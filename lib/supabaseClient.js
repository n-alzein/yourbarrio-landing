// lib/supabaseClient.js
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

let supabase = null;

function getCookieName() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return undefined;
  return `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
}

export function getBrowserSupabaseClient() {
  if (typeof window === "undefined") return null;

  if (!supabase) {
    const cookieName = getCookieName();

    supabase = createClientComponentClient({
      cookieOptions: cookieName ? { name: cookieName } : undefined,
    });
  }

  return supabase;
}
