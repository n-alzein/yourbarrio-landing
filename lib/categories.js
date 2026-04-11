import {
  getLaunchCategorySlugs,
  normalizeLaunchCategory,
  sortLaunchCategoryRows,
} from "@/lib/launchCategories";

export async function fetchCategoryByName(client, name) {
  const normalized = typeof name === "string" ? name.trim() : "";
  if (!client || !normalized) return null;
  const { data, error } = await client
    .from("business_categories")
    .select("id,name,slug")
    .eq("name", normalized)
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    console.warn("fetchCategoryByName failed", error);
    return null;
  }
  return data || null;
}

export async function fetchCategoryBySlug(client, slug) {
  const normalized = typeof slug === "string" ? slug.trim() : "";
  if (!client || !normalized) return null;
  const { data, error } = await client
    .from("business_categories")
    .select("id,name,slug")
    .eq("slug", normalized)
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    console.warn("fetchCategoryBySlug failed", error);
    return null;
  }
  return data || null;
}

export async function resolveCategoryIdByName(client, name) {
  const category = await fetchCategoryByName(client, name);
  return category?.id ?? null;
}

export async function fetchCategoriesByNamesOrSlugs(client, values) {
  const normalizedValues = Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean)
    )
  );
  if (!client || normalizedValues.length === 0) return [];

  const [namesResult, slugsResult] = await Promise.all([
    client
      .from("business_categories")
      .select("id,name,slug")
      .in("name", normalizedValues),
    client
      .from("business_categories")
      .select("id,name,slug")
      .in("slug", normalizedValues),
  ]);

  const errors = [namesResult.error, slugsResult.error].filter(Boolean);
  if (errors.length) {
    console.warn("fetchCategoriesByNamesOrSlugs failed", errors[0]);
    return [];
  }

  const deduped = new Map();
  for (const row of [...(namesResult.data || []), ...(slugsResult.data || [])]) {
    if (row?.id) deduped.set(row.id, row);
  }

  return Array.from(deduped.values());
}

export async function fetchLaunchCategoryBySlug(client, slug) {
  const canonicalSlug = normalizeLaunchCategory(slug);
  if (!client || !canonicalSlug) return null;
  const { data, error } = await client
    .from("business_categories")
    .select("id,name,slug,is_active")
    .eq("slug", canonicalSlug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    console.warn("fetchLaunchCategoryBySlug failed", error);
    return null;
  }
  return data || null;
}

export async function fetchActiveLaunchCategories(client) {
  const launchSlugs = getLaunchCategorySlugs();
  if (!client || launchSlugs.length === 0) return [];
  const { data, error } = await client
    .from("business_categories")
    .select("id,name,slug,is_active")
    .in("slug", launchSlugs)
    .eq("is_active", true);
  if (error) {
    console.warn("fetchActiveLaunchCategories failed", error);
    return [];
  }
  return sortLaunchCategoryRows(Array.isArray(data) ? data : []);
}
