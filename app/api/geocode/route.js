import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const address = body?.address;
    if (!address) {
      return NextResponse.json({ error: "address required" }, { status: 400 });
    }

    const token = process.env.MAPBOX_GEOCODING_TOKEN;
    if (!token) {
      return NextResponse.json({ error: "server geocoding token missing" }, { status: 500 });
    }

    const params = new URLSearchParams({
      access_token: token,
      limit: "1",
    });
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      address
    )}.json?${params.toString()}`;

    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: "failed to contact geocoding service" }, { status: 502 });
    }

    const data = await res.json();
    const feature = Array.isArray(data?.features) ? data.features[0] : null;
    const center = feature?.center;

    if (
      !feature ||
      !Array.isArray(center) ||
      center.length < 2 ||
      typeof center[0] !== "number" ||
      typeof center[1] !== "number"
    ) {
      return NextResponse.json({ error: "ZERO_RESULTS", details: data }, { status: 404 });
    }

    const [lng, lat] = center;
    return NextResponse.json({ lat, lng });
  } catch (err) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
