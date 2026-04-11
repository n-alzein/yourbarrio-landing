import {
  LAUNCH_CATEGORIES as BUSINESS_CATEGORIES,
  LAUNCH_CATEGORY_BY_NAME as CATEGORY_BY_NAME,
  LAUNCH_CATEGORY_BY_SLUG as CATEGORY_BY_SLUG,
  getLaunchCategory as getBusinessCategory,
  normalizeLaunchCategory,
} from "@/lib/launchCategories";

export { BUSINESS_CATEGORIES, CATEGORY_BY_NAME, CATEGORY_BY_SLUG, getBusinessCategory };

export function normalizeCategoryName(value = "") {
  return normalizeLaunchCategory(value) || "";
}
