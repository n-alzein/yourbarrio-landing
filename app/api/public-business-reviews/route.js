import { NextResponse } from "next/server";
import { getPublicSupabaseServerClient } from "@/lib/supabasePublicServer";
import { fetchBusinessReviews } from "@/lib/publicBusinessProfile/reviews";

function parseInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const businessId = String(searchParams.get("businessId") || "").trim();
  if (!businessId) {
    return NextResponse.json({ error: "businessId required" }, { status: 400 });
  }

  const from = parseInteger(searchParams.get("from"));
  const to = parseInteger(searchParams.get("to"));
  const limit = parseInteger(searchParams.get("limit"));
  const customerId = String(searchParams.get("customerId") || "").trim() || null;
  const single = searchParams.get("single") === "1";

  const supabase = getPublicSupabaseServerClient();
  const reviews = await fetchBusinessReviews(supabase, {
    businessId,
    from: typeof from === "number" ? from : undefined,
    to: typeof to === "number" ? to : undefined,
    limit: typeof limit === "number" ? limit : undefined,
    customerId,
    single,
  });

  return NextResponse.json({ reviews });
}
