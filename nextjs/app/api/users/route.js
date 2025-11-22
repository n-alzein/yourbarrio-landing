import { getUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";


export async function GET(request) {
  const user = await getUser(request);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data } = await supabaseServer.from("users").select("*");
  return Response.json(data);
}

export async function POST(request) {
  const user = await getUser(request);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = await request.json();
  const { data, error } = await supabaseServer.from("users").insert(body).single();

  if (error) return Response.json({ error }, { status: 400 });

  return Response.json(data);
}
