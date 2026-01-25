import { getSupabaseServerClient } from "@/lib/supabaseServer";

export async function GET(req, { params }) {
  const supabase = await getSupabaseServerClient();
  const { id } = params;

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
