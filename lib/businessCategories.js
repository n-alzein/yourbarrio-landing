"use client";

// Shared list of supported business categories for onboarding and listings.
// Legacy values are included to avoid breaking existing records.
const CORE_CATEGORIES = [
  "Food & Drink",
  "Health & Beauty",
  "Retail & Shopping",
  "Fitness & Wellness",
  "Home Services",
  "Professional Services",
  "Automotive",
  "Pets & Animals",
  "Arts & Entertainment",
  "Events & Venues",
  "Education & Classes",
  "Sports & Recreation",
  "Travel & Hospitality",
  "Nonprofit & Community",
  "Tech & Electronics",
  "Kids & Family",
  "Real Estate",
];

const LEGACY_CATEGORIES = ["Food", "Beauty", "Training", "Services", "Clothing"];

export const BUSINESS_CATEGORIES = [
  ...CORE_CATEGORIES,
  ...LEGACY_CATEGORIES.filter((c) => !CORE_CATEGORIES.includes(c)),
];
