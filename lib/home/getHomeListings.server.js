import "server-only";

import { unstable_cache } from "next/cache";
import { createServerClient } from "@supabase/ssr";

function createPublicSupabaseClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    }
  );
}

const cachedHomeListings = unstable_cache(
  async (limit, city, category) => {
    const supabase = createPublicSupabaseClient();
    let query = supabase
      .from("listings")
      .select(
        "id,title,price,category,city,photo_url,business_id,created_at,inventory_status,inventory_quantity,low_stock_threshold,inventory_last_updated_at"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (city) {
      query = query.eq("city", city);
    }
    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;
    if (error) {
      console.error("getHomeListings failed", error);
      return null;
    }

    return data || [];
  },
  ["home:listings"],
  { revalidate: 30 }
);

export async function getHomeListings({ limit = 80, city, category } = {}) {
  return cachedHomeListings(limit, city ?? null, category ?? null);
}
