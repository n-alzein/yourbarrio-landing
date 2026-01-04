import { createSupabaseServerClient } from "@/lib/supabaseServer";


export async function getUser(request) {
  // Extract token from "Authorization: Bearer <token>"
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");

  if (!token) return null;

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) return null;

  return data.user;
}
