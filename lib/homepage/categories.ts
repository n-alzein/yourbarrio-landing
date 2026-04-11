export type HomepageCategory = {
  slug: string;
  label: string;
  href: string;
  imageSrc: string;
  enabled: boolean;
  sortOrder: number;
};

export const HOMEPAGE_CATEGORY_FALLBACK_IMAGE = "/images/categories/clothing-fashion.png";

export const HOMEPAGE_CATEGORIES: HomepageCategory[] = [
  {
    slug: "clothing-fashion",
    label: "Clothing & Fashion",
    href: "/categories/clothing-fashion",
    imageSrc: "/images/categories/clothing-fashion.png",
    enabled: true,
    sortOrder: 1,
  },
  {
    slug: "beauty-personal-care",
    label: "Beauty & Personal Care",
    href: "/categories/beauty-personal-care",
    imageSrc: "/images/categories/beauty-personal-care.png",
    enabled: true,
    sortOrder: 2,
  },
  {
    slug: "home-decor",
    label: "Home & Decor",
    href: "/categories/home-decor",
    imageSrc: "/images/categories/home-decor.png",
    enabled: true,
    sortOrder: 3,
  },
  {
    slug: "jewelry-accessories",
    label: "Jewelry & Accessories",
    href: "/categories/jewelry-accessories",
    imageSrc: "/images/categories/jewelry-accessories.png",
    enabled: true,
    sortOrder: 4,
  },
  {
    slug: "gifts-crafts",
    label: "Gifts & Crafts",
    href: "/categories/gifts-crafts",
    imageSrc: "/images/categories/gifts-crafts.png",
    enabled: true,
    sortOrder: 5,
  },
  {
    slug: "flowers-plants",
    label: "Flowers & Plants",
    href: "/categories/flowers-plants",
    imageSrc: "/images/categories/flowers-plant.png",
    enabled: true,
    sortOrder: 6,
  },
  {
    slug: "art-handmade",
    label: "Art & Handmade",
    href: "/categories/art-handmade",
    imageSrc: "/images/categories/art-handmade.png",
    enabled: false,
    sortOrder: 7,
  },
  {
    slug: "books-stationery",
    label: "Books & Stationery",
    href: "/categories/books-stationery",
    imageSrc: "/images/categories/books-stationery.png",
    enabled: false,
    sortOrder: 8,
  },
];

export function getHomepageCategories(includeDisabled = false) {
  return HOMEPAGE_CATEGORIES
    .filter((category) => includeDisabled || category.enabled)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}
