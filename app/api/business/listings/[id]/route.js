import { NextResponse } from "next/server";
import { getBusinessDataClientForRequest } from "@/lib/business/getBusinessDataClientForRequest";

export async function GET(request, { params }) {
  const access = await getBusinessDataClientForRequest();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const supabase = access.client;
  const effectiveUserId = access.effectiveUserId;

  const listingId = params?.id;
  if (!listingId) {
    return NextResponse.json({ error: "Missing listing id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("listings")
    .select("*, category_info:business_categories(name,slug)")
    .eq("id", listingId)
    .eq("business_id", effectiveUserId)
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
