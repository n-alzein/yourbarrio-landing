// Shared list of supported business categories for onboarding and listings.
// Legacy values are included to avoid breaking existing records.
export function slugifyCategoryName(name = "") {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeCategoryName(name = "") {
  return name.trim().replace(/\s+/g, " ");
}

const CORE_CATEGORIES = [
  "Arts & Crafts",
  "Arts & Entertainment",
  "Automotive",
  "Baby & Maternity",
  "Bedding & Bath",
  "Books & Media",
  "Clothing & Accessories",
  "Computers & Accessories",
  "Fitness & Wellness",
  "Food & Drink",
  "Furniture",
  "Garden & Outdoor",
  "Grocery & Gourmet",
  "Handmade & Artisan",
  "Health & Beauty",
  "Health & Household",
  "Home & Kitchen",
  "Home Services",
  "Industrial & Scientific",
  "Jewelry & Watches",
  "Kids & Family",
  "Mobile & Accessories",
  "Music & Instruments",
  "Office & School",
  "Pets & Animals",
  "Photography",
  "Professional Services",
  "Shoes",
  "Smart Home",
  "Sports & Outdoors",
  "Sports & Recreation",
  "Tech & Electronics",
  "Tools & Home Improvement",
  "Toys & Games",
  "Travel & Hospitality",
  "Travel & Luggage",
  "Video Games",
].map((name) => ({
  name,
  slug: slugifyCategoryName(name),
}));

export const BUSINESS_CATEGORIES = [...CORE_CATEGORIES];

export const CATEGORY_BY_SLUG = new Map(
  BUSINESS_CATEGORIES.map((category) => [category.slug, category])
);
export const CATEGORY_BY_NAME = new Map(
  BUSINESS_CATEGORIES.map((category) => [normalizeCategoryName(category.name), category])
);
