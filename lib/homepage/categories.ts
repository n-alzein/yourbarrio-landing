import { getListingCategories } from "@/lib/taxonomy/listingCategories";

export type HomepageCategory = {
  slug: string;
  label: string;
  href: string;
  imageSrc: string;
  enabled: boolean;
  sortOrder: number;
};

export const HOMEPAGE_CATEGORY_FALLBACK_IMAGE = "/images/categories/clothing-fashion.png";

const HOMEPAGE_CATEGORY_IMAGE_BY_SLUG: Record<string, string> = {
  "clothing-fashion": "/images/categories/clothing-fashion.png",
  "beauty-personal-care": "/images/categories/beauty-personal-care.png",
  "home-decor": "/images/categories/home-decor.png",
  "jewelry-accessories": "/images/categories/jewelry-accessories.png",
  "books-stationery": "/images/categories/books-stationery.png",
};

const HOMEPAGE_IMAGE_BACKED_SLUGS = new Set([
  "clothing-fashion",
  "beauty-personal-care",
  "home-decor",
  "jewelry-accessories",
]);

const HOMEPAGE_IMAGE_BACKED_FALLBACKS: HomepageCategory[] = [
  {
    slug: "flowers-plants",
    label: "Flowers & Plants",
    href: "/listings?category=flowers-plants",
    imageSrc: "/images/categories/flowers-plant.png",
    enabled: true,
    sortOrder: 6,
  },
  {
    slug: "art-handmade",
    label: "Art & Handmade",
    href: "/listings?category=art-handmade",
    imageSrc: "/images/categories/art-handmade.png",
    enabled: true,
    sortOrder: 7,
  },
];

export const HOMEPAGE_CATEGORIES: HomepageCategory[] = [
  ...getListingCategories()
    .filter((category) => HOMEPAGE_IMAGE_BACKED_SLUGS.has(category.slug))
    .map((category) => ({
      slug: category.slug,
      label: category.label,
      href: `/listings?category=${category.slug}`,
      imageSrc:
        HOMEPAGE_CATEGORY_IMAGE_BY_SLUG[category.slug] || HOMEPAGE_CATEGORY_FALLBACK_IMAGE,
      enabled: true,
      sortOrder: category.sortOrder,
    })),
  ...HOMEPAGE_IMAGE_BACKED_FALLBACKS,
];

export function getHomepageCategories(includeDisabled = false) {
  return HOMEPAGE_CATEGORIES
    .filter((category) => includeDisabled || category.enabled)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}
