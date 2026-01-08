const DEFAULT_LOW_STOCK_THRESHOLD = 5;

export function getLowStockThreshold(listing) {
  const raw = listing?.low_stock_threshold;
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  return DEFAULT_LOW_STOCK_THRESHOLD;
}

export function normalizeInventory(listing) {
  const statusKey = listing?.inventory_status || "in_stock";
  const quantityRaw = listing?.inventory_quantity;
  const quantity = quantityRaw === null || quantityRaw === undefined
    ? null
    : Number(quantityRaw);
  const threshold = getLowStockThreshold(listing);

  if (statusKey === "out_of_stock") {
    return { availability: "out", label: "Out of stock", statusKey };
  }

  if (statusKey === "always_available" || statusKey === "seasonal") {
    return { availability: "available", label: "Available", statusKey };
  }

  if (statusKey === "low_stock") {
    return { availability: "low", label: "Low stock", statusKey };
  }

  if (quantity === null || Number.isNaN(quantity)) {
    return { availability: "available", label: "Available", statusKey };
  }

  if (quantity <= 0) {
    return { availability: "out", label: "Out of stock", statusKey };
  }

  if (quantity <= threshold) {
    return { availability: "low", label: "Low stock", statusKey };
  }

  return { availability: "available", label: "Available", statusKey };
}

export function sortListingsByAvailability(listings) {
  if (!Array.isArray(listings)) return [];
  const rank = { available: 0, low: 1, out: 2 };

  return listings
    .map((item, index) => {
      const availability = normalizeInventory(item).availability;
      return {
        item,
        index,
        rank: rank[availability] ?? 0,
      };
    })
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ item }) => item);
}

export const AVAILABILITY_BADGE_PALETTE = {
  available: {
    light: { color: "#065f46", border: "#047857" },
    dark: { color: "#d1fae5", border: "rgba(110, 231, 183, 0.7)" },
  },
  low: {
    light: { color: "#92400e", border: "#b45309" },
    dark: { color: "#fef3c7", border: "rgba(252, 211, 77, 0.7)" },
  },
  out: {
    light: { color: "#9f1239", border: "#be123c" },
    dark: { color: "#ffe4e6", border: "rgba(251, 113, 133, 0.7)" },
  },
};

export function getAvailabilityBadgeStyle(availability, isLight) {
  const palette = AVAILABILITY_BADGE_PALETTE[availability];
  if (!palette) return null;
  return isLight ? palette.light : palette.dark;
}
