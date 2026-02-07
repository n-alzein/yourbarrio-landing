import "server-only";

import { getSupabaseServerClient as getCookieServerClient } from "@/lib/supabaseServer";
import { getSupabaseServerClient as getServiceRoleClient } from "@/lib/supabase/server";

export function isAdminBypassRlsEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    String(process.env.ADMIN_BYPASS_RLS || "").toLowerCase() === "true"
  );
}

export async function getAdminDataClient() {
  if (isAdminBypassRlsEnabled()) {
    const serviceClient = getServiceRoleClient();
    if (!serviceClient) {
      throw new Error("Missing service role Supabase client for admin bypass mode");
    }
    return { client: serviceClient, usingServiceRole: true };
  }

  const cookieClient = await getCookieServerClient();
  if (!cookieClient) {
    throw new Error("Missing cookie-based Supabase server client");
  }

  return { client: cookieClient, usingServiceRole: false };
}
