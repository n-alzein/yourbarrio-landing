"use client";

import { useEffect } from "react";
import { normalizeInventory } from "@/lib/inventory";

export default function InventorySelfTest() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    const cases = [
      {
        name: "null quantity + in_stock => available",
        listing: { inventory_status: "in_stock", inventory_quantity: null },
        expect: "available",
      },
      {
        name: "quantity 0 => out",
        listing: { inventory_status: "in_stock", inventory_quantity: 0 },
        expect: "out",
      },
      {
        name: "quantity 3 threshold 5 => low",
        listing: {
          inventory_status: "in_stock",
          inventory_quantity: 3,
          low_stock_threshold: 5,
        },
        expect: "low",
      },
      {
        name: "always available => available",
        listing: { inventory_status: "always_available", inventory_quantity: 0 },
        expect: "available",
      },
    ];

    cases.forEach((entry) => {
      const result = normalizeInventory(entry.listing);
      console.assert(
        result.availability === entry.expect,
        `[inventory] ${entry.name} (got ${result.availability})`
      );
    });
  }, []);

  return null;
}
