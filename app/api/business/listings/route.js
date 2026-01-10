import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function GET(request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const listingId = searchParams.get("id");

  if (listingId) {
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

  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("business_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load listings" },
      { status: 500 }
    );
  }

  const response = NextResponse.json({ listings: data || [] }, { status: 200 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
