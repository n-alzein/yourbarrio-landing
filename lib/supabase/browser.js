import {
  acknowledgeAuthTokenInvalid,
  clearSupabaseAuthStorage,
  getAuthGuardState,
  getCookieName,
  getFreshBrowserSupabaseClient,
  getSupabaseBrowserClient as getClient,
  resetSupabaseClient,
  subscribeAuthGuard,
} from "@/lib/supabaseClient";

function ensureBrowserEnv() {
  if (process.env.NODE_ENV === "production") return;
  const missing = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  if (missing.length) {
    throw new Error(`Missing Supabase env: ${missing.join(", ")}`);
  }
}

export function getSupabaseBrowserClient() {
  ensureBrowserEnv();
  return getClient();
}

export {
  acknowledgeAuthTokenInvalid,
  clearSupabaseAuthStorage,
  getAuthGuardState,
  getCookieName,
  getFreshBrowserSupabaseClient,
  resetSupabaseClient,
  subscribeAuthGuard,
};
