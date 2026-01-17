import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getCookieBaseOptions } from "@/lib/authCookies";

function createSessionSupabaseClient(cookieStore, cookieBaseOptions) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, {
                ...options,
                ...cookieBaseOptions,
              });
            });
          } catch {}
        },
      },
    }
  );
}

function createServiceSupabaseClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
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

async function runHomeListingsQuery(client, { limit, city, category }) {
  let query = client
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

  return query;
}

export async function GET(request) {
  const url = new URL(request.url);
  const isProd = process.env.NODE_ENV === "production";
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

  const cookieStore = await cookies();
  const cookieBaseOptions = getCookieBaseOptions({
    host: request.headers.get("host"),
    isProd,
  });
  const sessionPresent = cookieStore.getAll().length > 0;
  const sessionClient = createSessionSupabaseClient(cookieStore, cookieBaseOptions);
  const serviceClient = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createServiceSupabaseClient()
    : null;

  const errors = [];
  let listings = [];
  let source = "none";

  try {
    const { data, error } = await runHomeListingsQuery(sessionClient, {
      limit,
      city,
      category,
    });
    if (error) {
      errors.push(`session:${error.message || String(error)}`);
    } else if (Array.isArray(data) && data.length > 0) {
      listings = data;
      source = "session";
    }
  } catch (err) {
    errors.push(`session:${err?.message || String(err)}`);
  }

  if ((!listings.length || source === "none") && serviceClient) {
    try {
      const { data, error } = await runHomeListingsQuery(serviceClient, {
        limit,
        city,
        category,
      });
      if (error) {
        errors.push(`service:${error.message || String(error)}`);
      } else if (Array.isArray(data)) {
        listings = data;
        source = "service";
      }
    } catch (err) {
      errors.push(`service:${err?.message || String(err)}`);
    }
  }

  if (listings.length === 0) {
    console.warn("[HOME_LISTINGS_PROD] 0 results", {
      supabaseHost,
      limit,
      city,
      category,
      sessionPresent,
      sourceTried: source,
      errors,
    });
  }

  if (!listings.length && errors.length) {
    return NextResponse.json(
      { error: "Home listings unavailable." },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
          "x-home-listings-count": "0",
          "x-home-listings-source": "none",
        },
      }
    );
  }

  const headers =
    listings.length === 0
      ? {
          "Cache-Control": "no-store",
          "x-home-listings-count": "0",
          "x-home-listings-source": source,
        }
      : {
          "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60",
          "x-home-listings-count": String(listings.length),
          "x-home-listings-source": source,
        };

  return NextResponse.json({ listings }, { status: 200, headers });
}
