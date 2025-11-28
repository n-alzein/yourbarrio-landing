"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

let supabase = null;

export function createBrowserClient() {
  if (!supabase) {
    supabase = createClientComponentClient();
  }
  return supabase;
}
