import { NextResponse } from "next/server";
import { getSupabaseServerClient, getUserCached } from "@/lib/supabaseServer";

export async function GET(request, { params }) {
  const supabase = await getSupabaseServerClient();
  const { user, error: userError } = await getUserCached(supabase);

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const listingId = params?.id;
  if (!listingId) {
    return NextResponse.json({ error: "Missing listing id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .eq("business_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load listing" },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const response = NextResponse.json({ listing: data }, { status: 200 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
