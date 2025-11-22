import { getUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase";


export async function GET(request, { params }) {
  const user = await getUser(request);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", params.id)
    .single();

  return Response.json(data);
}

export async function PUT(request, { params }) {
  const user = await getUser(request);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const updates = await request.json();

  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", params.id)
    .single();

  if (error) return Response.json({ error }, { status: 400 });

  return Response.json(data);
}

export async function DELETE(request, { params }) {
  const user = await getUser(request);
  if (!user) return new Response("Unauthorized", { status: 401 });

  await supabase.from("users").delete().eq("id", params.id);

  return Response.json({ success: true });
}
