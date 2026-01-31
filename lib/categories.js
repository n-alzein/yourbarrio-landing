export async function fetchCategoryByName(client, name) {
  const normalized = typeof name === "string" ? name.trim() : "";
  if (!client || !normalized) return null;
  const { data, error } = await client
    .from("business_categories")
    .select("id,name,slug")
    .eq("name", normalized)
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
