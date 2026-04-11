import {
  getBusinessTypePlaceholder as getMappedBusinessTypePlaceholder,
} from "@/lib/placeholders/businessPlaceholders";
import { getBusinessTypeSlug, getListingCategorySlug } from "@/lib/taxonomy/compat";

const DEFAULT_LISTING_PLACEHOLDER = "/listing-placeholder.png";

const LISTING_CATEGORY_KEYWORDS = [
  ["beauty-personal-care", "/images/fallback/categories/beauty.png"],
  ["clothing-fashion", "/images/fallback/categories/fashion.png"],
  ["electronics-tech", "/images/fallback/categories/tech.png"],
  ["flowers-plants", "/images/fallback/categories/garden.png"],
  ["art-handmade", "/images/fallback/categories/creative.png"],
  ["home-decor", "/images/fallback/categories/home-and-kitchen.png"],
  ["home-goods-appliances", "/images/fallback/categories/tools.png"],
  ["books-stationery", "/images/fallback/categories/creative.png"],
  ["jewelry-accessories", "/images/fallback/categories/handmade.png"],
  ["sports-outdoors", "/images/fallback/categories/garden.png"],
  ["toys-games", "/images/fallback/categories/kids.png"],
];

export function getBusinessTypePlaceholder(input) {
  const slug = getBusinessTypeSlug(input);
  return getMappedBusinessTypePlaceholder(slug || input?.category || null);
}

export function getListingCategoryPlaceholder(input) {
  const slug = getListingCategorySlug(input);
  const match = LISTING_CATEGORY_KEYWORDS.find(([keyword]) => slug.includes(keyword));
  return match?.[1] || DEFAULT_LISTING_PLACEHOLDER;
}
