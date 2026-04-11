import {
  getListingCategories,
  getListingCategory,
  getListingCategoryDbNames,
  getListingCategoryDbSlugs,
  normalizeListingCategory,
} from "@/lib/taxonomy/listingCategories";

export const LISTINGS_BROWSE_CATEGORIES = [
  {
    value: "all",
    label: "All",
    aliases: ["all", "everything"],
  },
  ...getListingCategories().map((category) => ({
    value: category.slug,
    label: category.label,
    aliases: [category.slug, ...(category.aliases || [])],
  })),
];

const LISTINGS_BROWSE_CATEGORY_BY_VALUE = new Map(
  LISTINGS_BROWSE_CATEGORIES.map((category) => [category.value, category])
);

export function getListingsBrowseCategoryOptions() {
  return LISTINGS_BROWSE_CATEGORIES.map(({ value, label }) => ({ value, label }));
}

export function getListingsBrowseCategory(value) {
  const raw = String(value || "").trim();
  if (!raw) return LISTINGS_BROWSE_CATEGORY_BY_VALUE.get("all") || null;
  const listingCategory = getListingCategory(raw);
  if (!listingCategory) return null;
  return LISTINGS_BROWSE_CATEGORY_BY_VALUE.get(listingCategory.slug) || null;
}

export function normalizeListingsBrowseCategory(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return {
      raw,
      canonical: "all",
      isValid: true,
      isDefault: true,
      isAlias: false,
    };
  }

  if (raw.toLowerCase() === "all") {
    return {
      raw,
      canonical: "all",
      isValid: true,
      isDefault: true,
      isAlias: false,
    };
  }

  const category = getListingsBrowseCategory(raw);
  if (!category) {
    return {
      raw,
      canonical: null,
      isValid: false,
      isDefault: false,
      isAlias: false,
    };
  }

  const canonical = normalizeListingCategory(raw) || category.value;
  return {
    raw,
    canonical,
    isValid: true,
    isDefault: canonical === "all",
    isAlias: canonical !== raw,
  };
}

export function getListingsBrowseFilterDefinition(value) {
  const normalized = normalizeListingsBrowseCategory(value);
  if (!normalized.isValid || !normalized.canonical) return null;
  return LISTINGS_BROWSE_CATEGORY_BY_VALUE.get(normalized.canonical) || null;
}

export function getListingsBrowseFilterCategoryNames(value) {
  if (!value || value === "all") return [];
  return getListingCategoryDbNames(value);
}

export function getListingsBrowseFilterCategorySlugs(value) {
  if (!value || value === "all") return [];
  return getListingCategoryDbSlugs(value);
}
