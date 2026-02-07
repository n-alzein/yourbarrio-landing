import "server-only";

import { getEffectiveActorAndTarget } from "@/lib/admin/supportMode";
import { getSupabaseServerClient as getServiceRoleClient } from "@/lib/supabase/server";
import { getSupabaseServerClient, getUserCached } from "@/lib/supabaseServer";

export async function getBusinessDataClientForRequest() {
  const supabase = await getSupabaseServerClient();
  const { user, error: userError } = await getUserCached(supabase);

  if (userError || !user?.id) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized",
    };
  }

  const resolved = await getEffectiveActorAndTarget(user.id);

  if (resolved.supportMode) {
    if (resolved.targetRole !== "business") {
      return {
        ok: false,
        status: 403,
        error: "Support mode target is not a business",
      };
    }

    const serviceClient = getServiceRoleClient();
    if (!serviceClient) {
      return {
        ok: false,
        status: 500,
        error: "Missing server data client",
      };
    }

    const { data: effectiveProfile, error: profileError } = await serviceClient
      .from("users")
      .select("id, role, business_name, full_name, profile_photo_url")
      .eq("id", resolved.effectiveUserId)
      .maybeSingle();

    if (profileError || !effectiveProfile) {
      return {
        ok: false,
        status: 404,
        error: "Business profile not found",
      };
    }

    return {
      ok: true,
      client: serviceClient,
      actorUserId: user.id,
      effectiveUserId: resolved.effectiveUserId,
      supportMode: true,
      effectiveProfile,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id, role, business_name, full_name, profile_photo_url")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      ok: false,
      status: 404,
      error: "Profile not found",
    };
  }

  if (profile.role !== "business") {
    return {
      ok: false,
      status: 403,
      error: "Forbidden",
    };
  }

  return {
    ok: true,
    client: supabase,
    actorUserId: user.id,
    effectiveUserId: user.id,
    supportMode: false,
    effectiveProfile: profile,
  };
}
