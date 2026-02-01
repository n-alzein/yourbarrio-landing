import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicSupabaseServerClient } from "@/lib/supabasePublicServer";
import { primaryPhotoUrl } from "@/lib/listingPhotos";
import SafeImage from "@/components/SafeImage";
import { fetchCategoryBySlug as fetchCategoryBySlugFromDb } from "@/lib/categories";
import { CATEGORY_BY_SLUG } from "@/lib/businessCategories";

export const revalidate = 60;

type SupabaseListing = {
  id: string;
  title?: string | null;
  price?: number | string | null;
  category?: string | null;
  category_info?: { name?: string | null; slug?: string | null }[] | null;
  city?: string | null;
  photo_url?: string | null;
  created_at?: string | null;
};

function formatPriceWithCents(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return "Price TBD";
  const number = Number(value);
  if (Number.isNaN(number)) return "Price TBD";
  return `$${number.toFixed(2)}`;
}

function splitPriceWithCents(value?: number | string | null) {
  const formatted = formatPriceWithCents(value);
  if (formatted === "Price TBD") {
    return { formatted, dollars: null, cents: null };
  }
  const normalized = formatted.replace("$", "");
  const [dollars, cents = "00"] = normalized.split(".");
  return { formatted, dollars, cents };
}

function humanizeSlug(slug: string) {
  return slug
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function CategoryListingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const categorySlug = slug?.trim();
  if (!categorySlug) notFound();

  let listings: SupabaseListing[] = [];
  const normalizedSlug = categorySlug.toLowerCase();
  let categoryName =
    CATEGORY_BY_SLUG.get(normalizedSlug)?.name || humanizeSlug(categorySlug);
  let listingsError: Error | null = null;
  try {
    const supabase = getPublicSupabaseServerClient();
    const categoryRow = await fetchCategoryBySlugFromDb(supabase, categorySlug);
    const fallbackCategory = CATEGORY_BY_SLUG.get(normalizedSlug);
    if (!categoryRow && !fallbackCategory) {
      notFound();
    }
    categoryName = categoryRow?.name || fallbackCategory?.name || categoryName;
    let query = supabase
      .from("listings")
      .select(
        "id,title,price,category,category_id,category_info:business_categories(name,slug),city,photo_url,created_at"
      )
      .order("created_at", { ascending: false })
      .limit(80);
    if (categoryRow?.id) {
      query = query.eq("category_id", categoryRow.id);
    } else {
      query = query.in("category", [categoryName, categorySlug]);
    }
    let { data, error } = await query;
    if (!error && categoryRow?.id && Array.isArray(data) && data.length === 0) {
      const fallbackQuery = supabase
        .from("listings")
        .select(
          "id,title,price,category,category_id,category_info:business_categories(name,slug),city,photo_url,created_at"
        )
        .in("category", [categoryName, categorySlug])
        .order("created_at", { ascending: false })
        .limit(80);
      const fallbackResult = await fallbackQuery;
      data = fallbackResult.data;
      error = fallbackResult.error;
    }
    if (error) {
      listingsError = error;
      console.error("Failed to load category listings", {
        slug: categorySlug,
        message: error.message,
      });
    } else {
      listings = Array.isArray(data) ? data : [];
    }
  } catch (error) {
    const digest = (error as { digest?: string } | null)?.digest || "";
    const message = (error as Error | null)?.message || "";
    if (digest === "NEXT_NOT_FOUND" || message.includes("NEXT_HTTP_ERROR_FALLBACK")) {
      throw error;
    }
    listingsError = error as Error;
    console.error("Failed to load category listings", {
      slug: categorySlug,
      error,
    });
  }
  console.log("[categories]", {
    slug: categorySlug,
    rows: listings.length,
    error: listingsError?.message,
  });
  const title =
    listings[0]?.category_info?.[0]?.name ||
    listings[0]?.category ||
    categoryName;

  return (
    <section className="w-full px-5 sm:px-6 md:px-8 lg:px-12 py-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link
            href="/listings"
            className="text-sm text-slate-500 hover:text-slate-900 transition"
          >
            ← Back to listings
          </Link>
          <h1 className="mt-3 text-2xl sm:text-3xl font-semibold text-slate-900">
            {title}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            All listings in this category
          </p>
        </div>

        {listingsError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-700">
            <div className="text-base font-semibold">Listings unavailable</div>
            <p className="mt-2 text-sm">
              We couldn’t load listings for this category. Please try again soon.
            </p>
          </div>
        ) : listings.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            No listings available for this category yet.
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-5 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {listings.map((item) => {
              const cover = primaryPhotoUrl(item.photo_url);
              return (
                <Link
                  key={item.id}
                  href={`/listings/${item.id}`}
                  className="group rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition overflow-hidden"
                >
                  <div className="relative w-full h-[200px] sm:h-[220px] lg:h-[240px] overflow-hidden bg-gray-50 p-2">
                    <SafeImage
                      src={cover}
                      alt={item.title || "Listing"}
                      className="h-full w-full object-contain transition duration-500 group-hover:scale-105"
                      loading="lazy"
                      onError={() => {}}
                      onLoad={() => {}}
                    />
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="h-7 text-slate-900 tabular-nums">
                      {(() => {
                        const price = splitPriceWithCents(item.price);
                        if (!price.dollars) {
                          return (
                            <span className="text-2xl font-bold leading-7">
                              {price.formatted}
                            </span>
                          );
                        }
                        return (
                          <span className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold leading-7">
                              ${price.dollars}
                            </span>
                            <span className="text-sm font-semibold uppercase leading-5">
                              {price.cents}
                            </span>
                          </span>
                        );
                      })()}
                    </div>
                    <h3 className="text-sm sm:text-base font-semibold text-slate-900 line-clamp-2">
                      {item.title || "Untitled listing"}
                    </h3>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
