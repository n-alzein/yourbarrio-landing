import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

const sanitize = (value) => (value || "").replace(/[%_]/g, "").trim();

async function searchListings(supabase, term) {
  const safe = sanitize(term);
  if (!safe) return [];

  const { data, error } = await supabase
    .from("listings")
    .select(
      "id,title,description,price,category,city,photo_url,business_id,created_at"
    )
    .or(
      `title.ilike.%${safe}%,description.ilike.%${safe}%,category.ilike.%${safe}%`
    )
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    console.warn("searchListings failed", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    price: row.price,
    category: row.category,
    city: row.city,
    photo_url: row.photo_url,
    business_id: row.business_id,
    source: "supabase_listing",
  }));
}

async function searchBusinesses(supabase, term) {
  const safe = sanitize(term);
  if (!safe) return [];

  const { data, error } = await supabase
    .from("users")
    .select(
      "id,business_name,full_name,category,city,address,description,website,profile_photo_url,role"
    )
    .eq("role", "business")
    .or(
      `business_name.ilike.%${safe}%,full_name.ilike.%${safe}%,category.ilike.%${safe}%,description.ilike.%${safe}%,city.ilike.%${safe}%`
    )
    .limit(8);

  if (error) {
    console.warn("searchBusinesses failed", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    name: row.business_name || row.full_name || "Local business",
    category: row.category,
    city: row.city,
    address: row.address,
    description: row.description,
    website: row.website,
    image: row.profile_photo_url,
    source: "supabase_business",
  }));
}

async function searchGooglePlaces(term) {
  const apiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName.text,places.formattedAddress,places.location,places.types",
      },
      body: JSON.stringify({
        textQuery: term,
        maxResultCount: 5,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.warn("Google Places search failed", res.status, body);
      return [];
    }

    const payload = await res.json();
    return (payload.places || []).map((place) => ({
      id: place.id,
      name: place.displayName?.text || "Place",
      address: place.formattedAddress || "",
      types: place.types || [],
      source: "google_places",
    }));
  } catch (err) {
    console.warn("Google Places search error", err);
    return [];
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim();

  if (!query) {
    return NextResponse.json({
      items: [],
      businesses: [],
      places: [],
      message: "empty query",
    });
  }

  let supabase = null;
  try {
    supabase = createSupabaseServerClient();
  } catch (err) {
    console.error("Failed to init Supabase client", err);
  }

  const [items, businesses, places] = await Promise.all([
    supabase ? searchListings(supabase, query) : [],
    supabase ? searchBusinesses(supabase, query) : [],
    searchGooglePlaces(query),
  ]);

  return NextResponse.json({
    items,
    businesses,
    places,
  });
}
