export function slugifyCategoryName(name = "") {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeCategoryName(name = "") {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function uniq(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function normalizeToken(value) {
  return slugifyCategoryName(normalizeCategoryName(value));
}

const CANONICAL_LISTING_CATEGORIES = [
  {
    label: "Clothing & Fashion",
    slug: "clothing-fashion",
    sortOrder: 1,
    aliases: [
      "clothing",
      "clothing-fashion",
      "clothing-and-accessories",
      "shoes",
    ],
    legacyLabels: ["Clothing", "Clothing & Accessories", "Shoes"],
    legacySlugs: ["clothing", "clothing-and-accessories", "shoes"],
  },
  {
    label: "Beauty & Personal Care",
    slug: "beauty-personal-care",
    sortOrder: 2,
    aliases: ["beauty", "beauty-personal-care", "health-and-beauty"],
    legacyLabels: ["Beauty", "Health & Beauty"],
    legacySlugs: ["beauty", "health-and-beauty"],
  },
  {
    label: "Home & Decor",
    slug: "home-decor",
    sortOrder: 3,
    aliases: [
      "home-decor",
      "home-and-kitchen",
      "furniture",
      "bedding-and-bath",
    ],
    legacyLabels: ["Home & Decor", "Home & Kitchen", "Furniture", "Bedding & Bath"],
    legacySlugs: ["home-decor", "home-and-kitchen", "furniture", "bedding-and-bath"],
  },
  {
    label: "Jewelry & Accessories",
    slug: "jewelry-accessories",
    sortOrder: 4,
    aliases: [
      "jewelry-accessories",
      "jewelry-and-watches",
      "accessory",
      "accessories",
    ],
    legacyLabels: ["Jewelry & Watches", "Accessory", "Accessories"],
    legacySlugs: ["jewelry-and-watches", "accessory", "accessories"],
  },
  {
    label: "Books & Stationery",
    slug: "books-stationery",
    sortOrder: 5,
    aliases: ["books", "books-stationery", "books-and-media", "office-and-school"],
    legacyLabels: ["Books", "Books & Media", "Office & School"],
    legacySlugs: ["books", "books-and-media", "office-and-school"],
  },
  {
    label: "Electronics & Tech",
    slug: "electronics-tech",
    sortOrder: 6,
    aliases: [
      "electronics",
      "electronics-tech",
      "computers-and-accessories",
      "mobile-and-accessories",
      "smart-home",
      "tech-and-electronics",
      "video-games",
    ],
    legacyLabels: [
      "Electronics",
      "Computers & Accessories",
      "Mobile & Accessories",
      "Smart Home",
      "Tech & Electronics",
      "Video Games",
    ],
    legacySlugs: [
      "electronics",
      "computers-and-accessories",
      "mobile-and-accessories",
      "smart-home",
      "tech-and-electronics",
      "video-games",
    ],
  },
  {
    label: "Home Goods & Appliances",
    slug: "home-goods-appliances",
    sortOrder: 7,
    aliases: ["home-goods-appliances", "tools-and-home-improvement"],
    legacyLabels: ["Tools & Home Improvement"],
    legacySlugs: ["tools-and-home-improvement"],
  },
  {
    label: "Toys & Games",
    slug: "toys-games",
    sortOrder: 8,
    aliases: ["toys-games", "toys-and-games"],
    legacyLabels: ["Toys & Games"],
    legacySlugs: ["toys-and-games"],
  },
  {
    label: "Sports & Outdoors",
    slug: "sports-outdoors",
    sortOrder: 9,
    aliases: [
      "sports-outdoors",
      "sports-and-outdoors",
      "sports-and-recreation",
      "fitness-and-wellness",
    ],
    legacyLabels: ["Sports & Outdoors", "Sports & Recreation", "Fitness & Wellness"],
    legacySlugs: ["sports-and-outdoors", "sports-and-recreation", "fitness-and-wellness"],
  },
  {
    label: "Other",
    slug: "other",
    sortOrder: 10,
    aliases: [
      "other",
      "gifts-specialty",
      "arts-and-crafts",
      "handmade-and-artisan",
      "flowers-plants",
      "pantry",
      "kitchen",
      "food-and-drink",
      "grocery-and-gourmet",
      "health-and-household",
      "home-services",
      "industrial-and-scientific",
      "kids-and-family",
      "music-and-instruments",
      "pets-and-animals",
      "photography",
      "professional-services",
      "travel-and-hospitality",
      "travel-and-luggage",
      "automotive",
      "pizza",
      "sushi",
      "coffee",
      "barber",
      "massage",
      "car-wash",
    ],
    legacyLabels: [
      "Other",
      "Gifts & Specialty",
      "Arts & Crafts",
      "Handmade & Artisan",
      "Flowers & Plants",
      "Pantry",
      "Kitchen",
      "Food & Drink",
      "Grocery & Gourmet",
      "Health & Household",
      "Home Services",
      "Industrial & Scientific",
      "Kids & Family",
      "Music & Instruments",
      "Pets & Animals",
      "Photography",
      "Professional Services",
      "Travel & Hospitality",
      "Travel & Luggage",
      "Automotive",
      "Pizza",
      "Sushi",
      "Coffee",
      "Barber",
      "Massage",
      "Car Wash",
    ],
    legacySlugs: [
      "other",
      "gifts-specialty",
      "arts-and-crafts",
      "handmade-and-artisan",
      "flowers-plants",
      "pantry",
      "kitchen",
      "food-and-drink",
      "grocery-and-gourmet",
      "health-and-household",
      "home-services",
      "industrial-and-scientific",
      "kids-and-family",
      "music-and-instruments",
      "pets-and-animals",
      "photography",
      "professional-services",
      "travel-and-hospitality",
      "travel-and-luggage",
      "automotive",
      "pizza",
      "sushi",
      "coffee",
      "barber",
      "massage",
      "car-wash",
    ],
  },
];

export const LISTING_CATEGORIES = CANONICAL_LISTING_CATEGORIES.map((category) => ({
  ...category,
  name: category.label,
}));

export const LISTING_CATEGORY_BY_SLUG = new Map(
  LISTING_CATEGORIES.map((category) => [category.slug, category])
);

export const LISTING_CATEGORY_BY_NAME = new Map(
  LISTING_CATEGORIES.map((category) => [normalizeCategoryName(category.label), category])
);

const LISTING_CATEGORY_BY_ALIAS = new Map(
  LISTING_CATEGORIES.flatMap((category) =>
    uniq([
      category.label,
      category.slug,
      ...(category.aliases || []),
      ...(category.legacyLabels || []),
      ...(category.legacySlugs || []),
    ]).map((value) => [normalizeToken(value), category])
  )
);

export function getListingCategories() {
  return [...LISTING_CATEGORIES].sort((left, right) => left.sortOrder - right.sortOrder);
}

export function getListingCategory(value) {
  const normalized = normalizeToken(value);
  if (!normalized) return null;
  return LISTING_CATEGORY_BY_ALIAS.get(normalized) || null;
}

export function resolveListingCategoryValue(value, { fallbackToOther = false } = {}) {
  const resolved = getListingCategory(value);
  if (resolved) return resolved;
  const raw = normalizeCategoryName(value);
  if (!raw) return null;
  return fallbackToOther ? LISTING_CATEGORY_BY_SLUG.get("other") || null : null;
}

export function normalizeListingCategory(value, options) {
  return resolveListingCategoryValue(value, options)?.slug || null;
}

export function getListingCategoryOptions() {
  return getListingCategories().map((category) => ({
    label: category.label,
    value: category.slug,
    slug: category.slug,
  }));
}

export function getListingCategoryDbNames(value) {
  const category = typeof value === "string" ? getListingCategory(value) : value;
  if (!category) return [];
  return uniq([category.label, ...(category.legacyLabels || [])]);
}

export function getListingCategoryDbSlugs(value) {
  const category = typeof value === "string" ? getListingCategory(value) : value;
  if (!category) return [];
  return uniq([category.slug, ...(category.legacySlugs || [])]);
}

export function getAllListingCategoryDbNames() {
  return uniq(getListingCategories().flatMap((category) => getListingCategoryDbNames(category)));
}

export function getAllListingCategoryDbSlugs() {
  return uniq(getListingCategories().flatMap((category) => getListingCategoryDbSlugs(category)));
}
