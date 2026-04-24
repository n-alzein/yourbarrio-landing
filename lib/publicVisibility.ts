import "server-only";

import { getProfileCached, getSupabaseServerClient, getUserCached } from "@/lib/supabaseServer";

export type VisibilityGate = {
  viewerCanSeeInternalContent: boolean;
};

export type PublicVisibilityTarget = {
  businessIsInternal?: boolean | null;
  listingIsInternal?: boolean | null;
};

export async function getCurrentViewerVisibilityGate(
  supabaseOverride?: Awaited<ReturnType<typeof getSupabaseServerClient>> | null
): Promise<VisibilityGate> {
  const supabase = supabaseOverride ?? (await getSupabaseServerClient());
  if (!supabase) {
    return { viewerCanSeeInternalContent: false };
  }

  const { user, error } = await getUserCached(supabase);
  if (error || !user?.id) {
    return { viewerCanSeeInternalContent: false };
  }

  const profile = await getProfileCached(user.id, supabase);
  return {
    viewerCanSeeInternalContent: profile?.is_internal === true,
  };
}

export function canViewerAccessPublicTarget(
  target: PublicVisibilityTarget,
  gate: VisibilityGate
): boolean {
  if (gate?.viewerCanSeeInternalContent) return true;
  if (target?.businessIsInternal === true) return false;
  if (target?.listingIsInternal === true) return false;
  return true;
}

