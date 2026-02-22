import { NextResponse } from "next/server";
import {
  CUSTOMER_NEARBY_PUBLIC_FLAG_KEY,
} from "@/lib/featureFlags";
import { getAdminServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  let enabled = false;
  let source: "db" | "fallback" = "fallback";
  let hasError = false;

  try {
    const client = getAdminServiceRoleClient();
    const { data, error } = await client
      .from("feature_flags")
      .select("enabled")
      .eq("key", CUSTOMER_NEARBY_PUBLIC_FLAG_KEY)
      .maybeSingle();

    if (error) {
      hasError = true;
    } else {
      enabled = data?.enabled === true;
      source = "db";
    }
  } catch {
    hasError = true;
  }

  return NextResponse.json(
    { enabled },
    {
      headers: {
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
        "x-flag-key": CUSTOMER_NEARBY_PUBLIC_FLAG_KEY,
        "x-flag-enabled": enabled ? "1" : "0",
        "x-flag-source": source,
        ...(hasError ? { "x-flag-error": "1" } : {}),
      },
    }
  );
}
