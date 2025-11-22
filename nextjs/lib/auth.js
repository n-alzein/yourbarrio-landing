import { supabase } from "./supabase";

export async function getUser(request) {
  // Extract token from "Authorization: Bearer <token>"
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");

  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) return null;

  return data.user;
}
