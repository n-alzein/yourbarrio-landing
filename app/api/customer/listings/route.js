import { NextResponse } from "next/server";
import { getSupabaseServerClient, getUserCached } from "@/lib/supabaseServer";

export async function GET(request) {
  const supabase = await getSupabaseServerClient();
  const { user, error: userError } = await getUserCached(supabase);

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const listingId = searchParams.get("id");

  if (!listingId) {
    return NextResponse.json({ error: "Missing listing id" }, { status: 400 });
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("*, category_info:business_categories(name,slug)")
    .eq("id", listingId)
    .maybeSingle();

  if (listingError) {
    return NextResponse.json(
      { error: listingError.message || "Failed to load listing" },
      { status: 500 }
    );
  }

  if (!listing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: business } = await supabase
    .from("users")
    .select(
      "id,business_name,full_name,category,city,address,website,phone,profile_photo_url"
    )
    .eq("id", listing.business_id)
    .maybeSingle();

  const { data: saved } = await supabase
    .from("saved_listings")
    .select("id")
    .eq("user_id", user.id)
    .eq("listing_id", listingId)
    .maybeSingle();

  const response = NextResponse.json(
    {
      listing,
      business: business || null,
      isSaved: Boolean(saved),
    },
    { status: 200 }
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
