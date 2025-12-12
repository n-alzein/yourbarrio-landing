import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

async function geocodeAddress(address) {
  const key = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!key || !address) return null;

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address
  )}&key=${key}`;

  const res = await fetch(url);
  if (!res.ok) {
    console.warn("Geocode request failed:", res.status);
    return null;
  }

  const data = await res.json();
  const loc = data?.results?.[0]?.geometry?.location;
  if (!loc?.lat || !loc?.lng) return null;
  return { lat: loc.lat, lng: loc.lng };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      userId,
      name,
      category,
      description,
      address,
      phone,
      website,
      latitude,
      longitude,
    } = body || {};

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Server is missing Supabase credentials" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const prefilledGeo =
      typeof latitude === "number" && typeof longitude === "number"
        ? { lat: latitude, lng: longitude }
        : null;
    const geo = prefilledGeo || (await geocodeAddress(address));

    const payload = {
      id: userId,
      name,
      category,
      description,
      address,
      phone,
      website,
      latitude: geo?.lat ?? null,
      longitude: geo?.lng ?? null,
    };

    const { data, error } = await supabase
      .from("businesses")
      .upsert(payload, { onConflict: "id" })
      .select("id")
      .single();

    if (error) {
      console.error("Business upsert failed", error);
      return NextResponse.json(
        { error: error.message || "Upsert failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({ id: data.id, geo });
  } catch (err) {
    console.error("Business create API error", err);
    return NextResponse.json(
      { error: err?.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}
