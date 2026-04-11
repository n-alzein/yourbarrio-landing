import { describe, expect, it } from "vitest";
import {
  getListingsBrowseFilterCategoryNames,
  getListingsBrowseFilterCategorySlugs,
  getListingsBrowseCategoryOptions,
  normalizeListingsBrowseCategory,
} from "@/lib/listings/browseCategories";

describe("listings browse categories", () => {
  it("uses canonical values for the public listings filter options", () => {
    expect(getListingsBrowseCategoryOptions()).toEqual([
      { value: "all", label: "All" },
      { value: "clothing-fashion", label: "Clothing & Fashion" },
      { value: "beauty-personal-care", label: "Beauty & Personal Care" },
      { value: "home-decor", label: "Home & Decor" },
      { value: "jewelry-accessories", label: "Jewelry & Accessories" },
      { value: "books-stationery", label: "Books & Stationery" },
      { value: "electronics-tech", label: "Electronics & Tech" },
      { value: "flowers-plants", label: "Flowers & Plants" },
      { value: "art-handmade", label: "Art & Handmade" },
      { value: "home-goods-appliances", label: "Home Goods & Appliances" },
      { value: "toys-games", label: "Toys & Games" },
      { value: "sports-outdoors", label: "Sports & Outdoors" },
      { value: "other", label: "Other" },
    ]);
  });

  it("normalizes launch and legacy aliases to one canonical category", () => {
    expect(normalizeListingsBrowseCategory("Clothing")).toMatchObject({
      canonical: "clothing-fashion",
      isValid: true,
    });
    expect(normalizeListingsBrowseCategory("clothing-fashion")).toMatchObject({
      canonical: "clothing-fashion",
      isValid: true,
    });
    expect(normalizeListingsBrowseCategory("Health & Beauty")).toMatchObject({
      canonical: "beauty-personal-care",
      isValid: true,
      isAlias: true,
    });
    expect(normalizeListingsBrowseCategory("Books & Media")).toMatchObject({
      canonical: "books-stationery",
      isValid: true,
      isAlias: true,
    });
    expect(normalizeListingsBrowseCategory("Video Games")).toMatchObject({
      canonical: "electronics-tech",
      isValid: true,
      isAlias: true,
    });
    expect(normalizeListingsBrowseCategory("Garden & Outdoor")).toMatchObject({
      canonical: "flowers-plants",
      isValid: true,
      isAlias: true,
    });
    expect(normalizeListingsBrowseCategory("Handmade & Artisan")).toMatchObject({
      canonical: "art-handmade",
      isValid: true,
      isAlias: true,
    });
    expect(normalizeListingsBrowseCategory("Massage")).toMatchObject({
      canonical: "other",
      isValid: true,
      isAlias: true,
    });
  });

  it("returns invalid for unknown category params instead of falling back to all", () => {
    expect(normalizeListingsBrowseCategory("not-a-real-category")).toEqual({
      raw: "not-a-real-category",
      canonical: null,
      isValid: false,
      isDefault: false,
      isAlias: false,
    });
  });

  it("maps canonical browse categories to strict listing taxonomy values", () => {
    expect(getListingsBrowseFilterCategoryNames("clothing-fashion")).toEqual([
      "Clothing & Fashion",
      "Clothing",
      "Clothing & Accessories",
      "Shoes",
    ]);
    expect(getListingsBrowseFilterCategorySlugs("electronics-tech")).toEqual([
      "electronics-tech",
      "electronics",
      "computers-and-accessories",
      "mobile-and-accessories",
      "smart-home",
      "tech-and-electronics",
      "video-games",
    ]);
    expect(getListingsBrowseFilterCategorySlugs("flowers-plants")).toEqual([
      "flowers-plants",
      "flowers",
      "garden-and-outdoor",
    ]);
    expect(getListingsBrowseFilterCategorySlugs("art-handmade")).toEqual([
      "art-handmade",
      "arts-and-crafts",
      "handmade-and-artisan",
      "arts-and-entertainment",
      "photography",
      "music-and-instruments",
    ]);
    expect(getListingsBrowseFilterCategorySlugs("other")).toEqual([
      "other",
      "gifts-specialty",
      "pantry",
      "kitchen",
      "food-and-drink",
      "grocery-and-gourmet",
      "health-and-household",
      "home-services",
      "industrial-and-scientific",
      "kids-and-family",
      "pets-and-animals",
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
    ]);
  });
});
