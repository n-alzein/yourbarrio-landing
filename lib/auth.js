import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getOptionalUser } from "@/lib/auth/safeGetUser";

export async function getUser(request) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;

  const supabase = await createSupabaseServerClient();
  const { user, error } = await getOptionalUser(supabase, { token });
  if (error || !user) return null;
  return user;
}
