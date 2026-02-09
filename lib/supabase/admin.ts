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

const adminDiagEnabled =
  String(process.env.AUTH_GUARD_DIAG || "") === "1" ||
  String(process.env.NEXT_PUBLIC_AUTH_DIAG || "") === "1";

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
    if (serviceClient) {
      return { client: serviceClient, usingServiceRole: true };
    }
    if (adminDiagEnabled || process.env.NODE_ENV !== "production") {
      console.warn(
        "[admin-data] service mode requested but SUPABASE_SERVICE_ROLE_KEY is unavailable; falling back to actor client"
      );
    }
  }

  const cookieClient = await getSupabaseServerAuthedClient();
  if (!cookieClient) {
    throw new Error("Missing cookie-based Supabase server client");
  }

  return { client: cookieClient, usingServiceRole: false };
}
