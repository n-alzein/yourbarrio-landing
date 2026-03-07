import "server-only";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
}

const shouldLogSupabaseEmailTrigger = process.env.DEBUG_SUPABASE_EMAIL === "1";

const instrumentedFetch: typeof fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input.url;
  if (
    shouldLogSupabaseEmailTrigger &&
    (url.includes("/auth/v1/otp") ||
      url.includes("/auth/v1/signup") ||
      url.includes("/auth/v1/invite"))
  ) {
    console.error("[supabase-email-trigger]", {
      url,
      method: init?.method || "GET",
    });
    console.error("[supabase-email-trigger stack]", new Error().stack);
  }
  return fetch(input as Parameters<typeof fetch>[0], init as Parameters<typeof fetch>[1]);
};

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    fetch: instrumentedFetch,
  },
});
