import { NextResponse } from "next/server";
import { getHomeListings } from "@/lib/home/getHomeListings.server";

export async function GET(request) {
  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get("limit") || 80);
  const limit = Number.isFinite(limitParam) ? Math.max(1, limitParam) : 80;
  const city = url.searchParams.get("city") || null;
  const category = url.searchParams.get("category") || null;
  const supabaseHost = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host;
    } catch {
      return "unknown";
    }
  })();

  const { data, error } = await getHomeListings({ limit, city, category });
  const listings = Array.isArray(data) ? data : [];

  if (error || listings.length === 0) {
    console.warn("[HOME_LISTINGS_PROD] 0 results", {
      supabaseHost,
      limit,
      city,
      category,
      error: error ? String(error.message || error) : null,
    });
  }

  const headers =
    error || listings.length === 0
      ? { "Cache-Control": "no-store" }
      : undefined;

  return NextResponse.json({ listings }, { status: 200, headers });
}
