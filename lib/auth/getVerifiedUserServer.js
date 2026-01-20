import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getOptionalUser } from "@/lib/auth/safeGetUser";

export async function getVerifiedUserServer(supabaseOverride) {
  const supabase = supabaseOverride ?? (await createSupabaseServerClient());
  const { user, error } = await getOptionalUser(supabase);
  if (error || !user) return null;
  return user;
}
