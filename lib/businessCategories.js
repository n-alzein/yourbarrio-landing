"use client";

// Shared list of supported business categories for onboarding and listings.
// Legacy values are included to avoid breaking existing records.
const CORE_CATEGORIES = [
  "Food & Drink",
  "Grocery & Gourmet",
  "Health & Beauty",
  "Beauty & Personal Care",
  "Health & Household",
  "Clothing & Accessories",
  "Shoes",
  "Jewelry & Watches",
  "Fitness & Wellness",
  "Home Services",
  "Professional Services",
  "Home & Kitchen",
  "Furniture",
  "Bedding & Bath",
  "Tools & Home Improvement",
  "Garden & Outdoor",
  "Arts & Crafts",
  "Books & Media",
  "Music & Instruments",
  "Toys & Games",
  "Baby & Maternity",
  "Office & School",
  "Sports & Outdoors",
  "Travel & Luggage",
  "Automotive",
  "Pets & Animals",
  "Tech & Electronics",
  "Computers & Accessories",
  "Mobile & Accessories",
  "Smart Home",
  "Photography",
  "Video Games",
  "Industrial & Scientific",
  "Arts & Entertainment",
  "Sports & Recreation",
  "Travel & Hospitality",
  "Kids & Family",
  "Handmade & Artisan",
];

const LEGACY_CATEGORIES = ["Food", "Beauty", "Training", "Services", "Clothing"];

export const BUSINESS_CATEGORIES = [
  ...CORE_CATEGORIES,
  ...LEGACY_CATEGORIES.filter((c) => !CORE_CATEGORIES.includes(c)),
];
