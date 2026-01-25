import { getSupabaseServerClient, getUserCached } from "@/lib/supabaseServer";

export async function getVerifiedUserServer(supabaseOverride) {
  const supabase = supabaseOverride ?? (await getSupabaseServerClient());
  const { user, error } = await getUserCached(supabase);
  if (error || !user) return null;
  return user;
}
