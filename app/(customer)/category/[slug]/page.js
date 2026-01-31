import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchCategoryBySlug } from "@/lib/strapi";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { primaryPhotoUrl } from "@/lib/listingPhotos";
import { fetchCategoryBySlug as fetchCategoryBySlugFromDb } from "@/lib/categories";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CategoryListingsPage({ params }) {
  const slug = params?.slug;
  if (!slug) notFound();

  let category = null;
  try {
    category = await fetchCategoryBySlug(slug);
  } catch (error) {
    console.error("Failed to load category", { slug, error });
  }

  if (!category) notFound();

  const supabase = getSupabaseServerClient();
  let listings = [];
  let categoryRow = null;
  if (supabase) {
    categoryRow = await fetchCategoryBySlugFromDb(supabase, slug);
    const categoryName = categoryRow?.name || category.name;
    let query = supabase
      .from("listings")
      .select(
        "id,title,description,price,category,category_id,category_info:business_categories(name,slug),city,photo_url,created_at,inventory_status,inventory_quantity,low_stock_threshold,inventory_last_updated_at"
      )
      .order("created_at", { ascending: false })
      .limit(80);
    if (categoryRow?.id) {
      query = query.eq("category_id", categoryRow.id);
    } else {
      query = query.in("category", [categoryName, slug]);
    }
    let { data, error } = await query;
    if (!error && categoryRow?.id && Array.isArray(data) && data.length === 0) {
      const fallbackQuery = supabase
        .from("listings")
        .select(
          "id,title,description,price,category,category_id,category_info:business_categories(name,slug),city,photo_url,created_at,inventory_status,inventory_quantity,low_stock_threshold,inventory_last_updated_at"
        )
        .in("category", [categoryName, slug])
        .order("created_at", { ascending: false })
        .limit(80);
      const fallbackResult = await fallbackQuery;
      data = fallbackResult.data;
      error = fallbackResult.error;
    }
    if (error) {
      console.error("Failed to load category listings", {
        slug,
        message: error.message,
      });
    } else {
      listings = Array.isArray(data) ? data : [];
    }
  }

  return (
    <section className="w-full px-5 sm:px-6 md:px-8 lg:px-12 py-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link
            href="/customer/home"
            className="text-sm text-slate-500 hover:text-slate-900 transition"
          >
            ← Back to home
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-slate-900">
            {categoryRow?.name || category.name}
          </h1>
          {category.tileSubtitle ? (
            <p className="mt-2 text-sm text-slate-600">{category.tileSubtitle}</p>
          ) : null}
        </div>

        {listings.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            No listings available for this category yet.
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((item) => {
              const cover = primaryPhotoUrl(item.photo_url);
              return (
                <Link
                  key={item.id}
                  href={`/customer/listings/${item.id}`}
                  className="group rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition overflow-hidden"
                >
                  <div className="relative h-40 bg-slate-100 flex items-center justify-center">
                    {cover ? (
                      <img
                        src={cover}
                        alt={item.title || "Listing"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-slate-400">No image</span>
                    )}
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      {item.category_info?.name || item.category || "Listing"}
                      {item.city ? ` · ${item.city}` : ""}
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 line-clamp-2">
                      {item.title}
                    </h3>
                    <div className="text-sm font-semibold text-slate-900">
                      {item.price ? `$${item.price}` : "Price TBD"}
                    </div>
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
