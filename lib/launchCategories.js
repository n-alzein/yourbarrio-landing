import { normalizeCategoryName, slugifyCategoryName } from "@/lib/taxonomy/listingCategories";

function uniq(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeToken(value) {
  return slugifyCategoryName(String(value || "").trim());
}

export const LAUNCH_CATEGORIES = [
  {
    name: "Clothing & Fashion",
    label: "Clothing & Fashion",
    slug: "clothing-fashion",
    sortOrder: 1,
    imageSrc: "/images/categories/clothing-fashion.png",
    aliases: ["clothing", "clothing-fashion"],
    legacyNames: ["Clothing", "Clothing & Accessories", "Shoes"],
    legacySlugs: ["clothing", "clothing-and-accessories", "shoes"],
  },
  {
    name: "Beauty & Personal Care",
    label: "Beauty & Personal Care",
    slug: "beauty-personal-care",
    sortOrder: 2,
    imageSrc: "/images/categories/beauty-personal-care.png",
    aliases: ["health-and-beauty", "beauty-personal-care"],
    legacyNames: ["Health & Beauty"],
    legacySlugs: ["health-and-beauty"],
  },
  {
    name: "Home & Decor",
    label: "Home & Decor",
    slug: "home-decor",
    sortOrder: 3,
    imageSrc: "/images/categories/home-decor.png",
    aliases: ["home-decor"],
    legacyNames: ["Home & Decor"],
    legacySlugs: ["home-decor"],
  },
  {
    name: "Jewelry & Accessories",
    label: "Jewelry & Accessories",
    slug: "jewelry-accessories",
    sortOrder: 4,
    imageSrc: "/images/categories/jewelry-accessories.png",
    aliases: ["jewelry-and-watches", "jewelry-accessories"],
    legacyNames: ["Jewelry & Watches"],
    legacySlugs: ["jewelry-and-watches"],
  },
  {
    name: "Gifts & Crafts",
    label: "Gifts & Crafts",
    slug: "gifts-crafts",
    sortOrder: 5,
    imageSrc: "/images/categories/gifts-crafts.png",
    aliases: ["gifts-specialty", "arts-and-crafts", "gifts-crafts"],
    legacyNames: ["Gifts & Specialty", "Arts & Crafts"],
    legacySlugs: ["gifts-specialty", "arts-and-crafts"],
  },
  {
    name: "Flowers & Plants",
    label: "Flowers & Plants",
    slug: "flowers-plants",
    sortOrder: 6,
    imageSrc: "/images/categories/flowers-plant.png",
    aliases: ["flowers-plants"],
    legacyNames: ["Flowers & Plants"],
    legacySlugs: ["flowers-plants"],
  },
  {
    name: "Art & Handmade",
    label: "Art & Handmade",
    slug: "art-handmade",
    sortOrder: 7,
    imageSrc: "/images/categories/art-handmade.png",
    aliases: ["handmade-and-artisan", "art-handmade"],
    legacyNames: ["Handmade & Artisan"],
    legacySlugs: ["handmade-and-artisan"],
  },
  {
    name: "Books & Stationery",
    label: "Books & Stationery",
    slug: "books-stationery",
    sortOrder: 8,
    imageSrc: "/images/categories/books-stationery.png",
    aliases: ["books-and-media", "office-and-school", "books-stationery"],
    legacyNames: ["Books & Media", "Office & School"],
    legacySlugs: ["books-and-media", "office-and-school"],
  },
];

export const LAUNCH_CATEGORY_BY_SLUG = new Map(
  LAUNCH_CATEGORIES.map((category) => [category.slug, category])
);

export const LAUNCH_CATEGORY_BY_NAME = new Map(
  LAUNCH_CATEGORIES.map((category) => [normalizeCategoryName(category.name), category])
);

const LAUNCH_CATEGORY_BY_ALIAS = new Map(
  LAUNCH_CATEGORIES.flatMap((category) =>
    uniq([
      category.slug,
      category.name,
      category.label,
      ...(category.aliases || []),
      ...(category.legacyNames || []),
      ...(category.legacySlugs || []),
    ]).map((value) => [normalizeToken(value), category])
  )
);

export function getLaunchCategories() {
  return [...LAUNCH_CATEGORIES].sort((left, right) => left.sortOrder - right.sortOrder);
}

export function getLaunchCategory(value) {
  const normalized = normalizeToken(value);
  if (!normalized) return null;
  return LAUNCH_CATEGORY_BY_ALIAS.get(normalized) || null;
}

export function normalizeLaunchCategory(value) {
  const category = getLaunchCategory(value);
  return category?.slug || null;
}

export function getLaunchCategoryDbNames(value) {
  const category = typeof value === "string" ? getLaunchCategory(value) : value;
  if (!category) return [];
  return uniq([category.name, ...(category.legacyNames || [])]);
}

export function getLaunchCategoryDbSlugs(value) {
  const category = typeof value === "string" ? getLaunchCategory(value) : value;
  if (!category) return [];
  return uniq([category.slug, ...(category.legacySlugs || [])]);
}

export function getAllLaunchCategoryDbNames() {
  return uniq(getLaunchCategories().flatMap((category) => getLaunchCategoryDbNames(category)));
}

export function getAllLaunchCategoryDbSlugs() {
  return uniq(getLaunchCategories().flatMap((category) => getLaunchCategoryDbSlugs(category)));
}

export function getLaunchCategorySlugs() {
  return getLaunchCategories().map((category) => category.slug);
}

export function getLaunchCategoryOptions() {
  return getLaunchCategories().map((category) => ({
    value: category.slug,
    label: category.label,
  }));
}

export function sortLaunchCategoryRows(rows = []) {
  const order = new Map(getLaunchCategories().map((category) => [category.slug, category.sortOrder]));
  return [...rows].sort((left, right) => {
    const leftCategory = getLaunchCategory(left?.slug || left?.name || "");
    const rightCategory = getLaunchCategory(right?.slug || right?.name || "");
    const leftOrder = order.get(leftCategory?.slug || "") ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = order.get(rightCategory?.slug || "") ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return String(left?.name || "").localeCompare(String(right?.name || ""));
  });
}
