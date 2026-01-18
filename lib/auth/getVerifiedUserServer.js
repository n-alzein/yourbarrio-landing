import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function getVerifiedUserServer(supabaseOverride) {
  const supabase = supabaseOverride ?? (await createSupabaseServerClient());
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
}
