import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { safeGetUser } from "@/lib/auth/safeGetUser";

export async function getVerifiedUserServer(supabaseOverride) {
  const supabase = supabaseOverride ?? (await createSupabaseServerClient());
  const { user, error } = await safeGetUser(supabase);
  if (error || !user) return null;
  return user;
}
