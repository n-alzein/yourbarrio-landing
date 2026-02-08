import "server-only";

import { getSupabaseServerAuthedClient } from "@/lib/supabaseServer";
import { getSupabaseServerClient as getServiceRoleClient } from "@/lib/supabase/server";

export function isAdminBypassRlsEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    String(process.env.ADMIN_BYPASS_RLS || "").toLowerCase() === "true"
  );
}

type AdminClientMode = "actor" | "service";

type GetAdminDataClientOptions = {
  mode?: AdminClientMode;
};

export function getAdminServiceRoleClient() {
  const serviceClient = getServiceRoleClient();
  if (!serviceClient) {
    throw new Error("Missing service role Supabase client");
  }
  return serviceClient;
}

export function getSupabaseServerAdminClient() {
  return getAdminServiceRoleClient();
}

export async function getAdminDataClient({ mode = "actor" }: GetAdminDataClientOptions = {}) {
  if (mode === "service" || isAdminBypassRlsEnabled()) {
    const serviceClient = getServiceRoleClient();
    if (!serviceClient) {
      throw new Error("Missing service role Supabase client for admin bypass mode");
    }
    return { client: serviceClient, usingServiceRole: true };
  }

  const cookieClient = await getSupabaseServerAuthedClient();
  if (!cookieClient) {
    throw new Error("Missing cookie-based Supabase server client");
  }

  return { client: cookieClient, usingServiceRole: false };
}
