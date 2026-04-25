import { describe, expect, it } from "vitest";
import {
  deriveListingInventoryFromVariants,
  generateVariantCombinations,
  getActiveVariantQuantityTotal,
  syncVariantsWithGeneratedCombinations,
  validateListingOptions,
} from "@/lib/listingOptions";

describe("listing options helpers", () => {
  it("generates all select combinations in attribute order", () => {
    const combinations = generateVariantCombinations([
      {
        name: "Size",
        type: "select",
        values: [{ value: "Small" }, { value: "Large" }],
      },
      {
        name: "Color",
        type: "select",
        values: [{ value: "Red" }, { value: "Blue" }],
      },
    ]);

    expect(combinations).toEqual([
      { Size: "Small", Color: "Red" },
      { Size: "Small", Color: "Blue" },
      { Size: "Large", Color: "Red" },
      { Size: "Large", Color: "Blue" },
    ]);
  });

  it("preserves matching variant data when regenerating combinations", () => {
    const variants = syncVariantsWithGeneratedCombinations(
      [
        {
          name: "Size",
          type: "select",
          values: [{ value: "Small" }, { value: "Large" }],
        },
      ],
      [
        {
          id: "variant-1",
          sku: "SMALL-1",
          price: 10,
          quantity: 3,
          options: { Size: "Small" },
        },
      ]
    );

    expect(variants).toEqual([
      expect.objectContaining({
        id: "variant-1",
        sku: "SMALL-1",
        quantity: 3,
        options: { Size: "Small" },
      }),
      expect.objectContaining({
        id: undefined,
        sku: "",
        quantity: 0,
        options: { Size: "Large" },
      }),
    ]);
  });

  it("preserves variant data when an option name changes but choices stay aligned", () => {
    const variants = syncVariantsWithGeneratedCombinations(
      [
        {
          name: "Finish",
          type: "select",
          values: [{ value: "Small" }, { value: "Large" }],
        },
      ],
      [
        {
          id: "variant-1",
          sku: "SMALL-1",
          price: 10,
          quantity: 3,
          options: { Size: "Small" },
        },
      ]
    );

    expect(variants[0]).toEqual(
      expect.objectContaining({
        id: "variant-1",
        sku: "SMALL-1",
        quantity: 3,
        options: { Finish: "Small" },
      })
    );
  });

  it("rejects duplicate attribute names and values", () => {
    const result = validateListingOptions({
      hasOptions: true,
      attributes: [
        {
          name: "Size",
          type: "select",
          values: [{ value: "Small" }, { value: "Small" }],
        },
        {
          name: " size ",
          type: "select",
          values: [{ value: "Large" }],
        },
      ],
      variants: [
        {
          quantity: 1,
          options: { Size: "Small" },
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors.attributes[0].values[1].value).toContain("unique");
    expect(result.errors.attributes[1].name).toContain("unique");
  });

  it("keeps empty variant price overrides as null", () => {
    const result = validateListingOptions({
      hasOptions: true,
      attributes: [
        {
          name: "Size",
          type: "select",
          values: [{ value: "Small" }],
        },
      ],
      variants: [
        {
          quantity: 1,
          price: "",
          options: { Size: "Small" },
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.normalized.variants[0].price).toBeNull();
  });

  it("rejects zero price overrides", () => {
    const result = validateListingOptions({
      hasOptions: true,
      attributes: [
        {
          name: "Size",
          type: "select",
          values: [{ value: "Small" }],
        },
      ],
      variants: [
        {
          quantity: 1,
          price: 0,
          options: { Size: "Small" },
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors.variants[0].price).toContain("0.01");
  });

  it("allows listings without options to validate cleanly", () => {
    const result = validateListingOptions({
      hasOptions: false,
      attributes: [],
      variants: [],
    });

    expect(result.ok).toBe(true);
    expect(result.normalized).toEqual({
      hasOptions: false,
      attributes: [],
      variants: [],
    });
  });

  it("derives total quantity from active variants only", () => {
    expect(
      getActiveVariantQuantityTotal([
        { quantity: 3, is_active: true },
        { quantity: 2, is_active: false },
        { quantity: 4 },
      ])
    ).toBe(7);
  });

  it("derives listing inventory from variant totals", () => {
    expect(
      deriveListingInventoryFromVariants(
        [
          { quantity: 2, is_active: true },
          { quantity: 1, is_active: true },
        ],
        5
      )
    ).toEqual({
      inventoryQuantity: 3,
      inventoryStatus: "low_stock",
    });

    expect(
      deriveListingInventoryFromVariants(
        [
          { quantity: 3, is_active: true },
          { quantity: 4, is_active: true },
        ],
        5
      )
    ).toEqual({
      inventoryQuantity: 7,
      inventoryStatus: "in_stock",
    });

    expect(
      deriveListingInventoryFromVariants(
        [{ quantity: 0, is_active: true }],
        5
      )
    ).toEqual({
      inventoryQuantity: 0,
      inventoryStatus: "out_of_stock",
    });
  });
});
