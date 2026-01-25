import "server-only";

import { cache } from "react";
import { createServerClient } from "@supabase/ssr";

export const getPublicSupabaseServerClient = cache(() => {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    }
  );
});

export const createPublicSupabaseServerClient = getPublicSupabaseServerClient;
