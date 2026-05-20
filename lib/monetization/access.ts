import "server-only";

import { getAdminRolesForUser } from "@/lib/admin/permissions";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getSupabaseServerClient as getServiceRoleClient } from "@/lib/supabase/server";
import { getUserCached } from "@/lib/supabaseServer";

export async function getMonetizationRequestContext() {
  const supabase = await getSupabaseServerClient();
  const { user } = await getUserCached(supabase);
  if (!user?.id) return { ok: false as const, status: 401, error: "Unauthorized" };
  const roles = await getAdminRolesForUser(user.id);
  const serviceClient = getServiceRoleClient() ?? supabase;
  return {
    ok: true as const,
    user,
    actorUserId: user.id,
    roles,
    isAdmin: roles.length > 0,
    supabase,
    serviceClient,
  };
}

export async function requireBusinessMonetizationReadAccess(businessId: string) {
  const context = await getMonetizationRequestContext();
  if (!context.ok) return context;

  const { data: business, error } = await context.serviceClient
    .from("businesses")
    .select("id,owner_user_id,business_name")
    .eq("id", businessId)
    .maybeSingle();

  if (error) return { ok: false as const, status: 500, error: error.message || "Failed to load business" };
  if (!business?.id) return { ok: false as const, status: 404, error: "Business not found" };
  if (!context.isAdmin && business.owner_user_id !== context.user.id) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  return { ...context, business };
}

export async function requireBusinessMonetizationAdminAccess(businessId: string) {
  const context = await requireBusinessMonetizationReadAccess(businessId);
  if (!context.ok) return context;
  if (!context.isAdmin) return { ok: false as const, status: 403, error: "Forbidden" };
  return context;
}

