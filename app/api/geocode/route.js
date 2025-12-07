import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const address = body?.address;
    if (!address) {
      return NextResponse.json({ error: "address required" }, { status: 400 });
    }

    const key = process.env.GOOGLE_GEOCODING_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "server geocoding key missing" }, { status: 500 });
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&key=${key}`;

    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: "failed to contact geocoding service" }, { status: 502 });
    }

    const data = await res.json();
    if (!data || data.status !== "OK" || !data.results || data.results.length === 0) {
      return NextResponse.json({ error: "ZERO_RESULTS", details: data }, { status: 404 });
    }

    const loc = data.results[0].geometry.location;
    return NextResponse.json({ lat: loc.lat, lng: loc.lng });
  } catch (err) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
