import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ListingMarketplaceCard from "@/app/(public)/listings/components/ListingMarketplaceCard";

const listingDetailsSource = readFileSync(
  path.join(process.cwd(), "app/(public)/listings/[id]/ListingDetailsClient.jsx"),
  "utf8"
);

let mockCartItems = [];
const mockAddItem = vi.fn(async () => ({}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, prefetch, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/components/SafeImage", () => ({
  __esModule: true,
  default: ({ alt, ...rest }) => <img alt={alt} {...rest} />,
}));

vi.mock("@/components/cart/CartProvider", () => ({
  useCart: () => ({
    addItem: mockAddItem,
    items: mockCartItems,
  }),
}));

describe("listing cart-aware availability", () => {
  beforeEach(() => {
    mockCartItems = [];
    mockAddItem.mockClear();
    global.fetch = vi.fn();
  });

  it("disables the listing card add-to-cart button when the user already holds all available units", async () => {
    mockCartItems = [
      {
        id: "cart-item-1",
        listing_id: "listing-1",
        quantity: 2,
        variant_id: null,
      },
    ];
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        available_quantity: 2,
      }),
    }));

    render(
      <ListingMarketplaceCard
        fallbackLocationLabel="Long Beach"
        listing={{
          id: "listing-1",
          public_id: "listing-1",
          title: "Salsa sampler",
          price: 12,
          business_id: "business-1",
          business_name: "Barrio Kitchen",
          inventory_status: "in_stock",
          inventory_quantity: 2,
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /in your cart/i })).toBeDisabled();
    });
  });

  it("keeps the listing detail unavailable state cart-aware when all units are already in the cart", () => {
    expect(listingDetailsSource).toContain("allAvailableUnitsAlreadyInCart");
    expect(listingDetailsSource).toContain("All available units are already in your cart.");
    expect(listingDetailsSource).toContain('"Currently unavailable"');
  });

  it("renders saved listing product images with card variants and contain fit", () => {
    render(
      <ListingMarketplaceCard
        fallbackLocationLabel="Long Beach"
        variant="saved"
        listing={{
          id: "listing-tall",
          public_id: "listing-tall",
          title: "Tall embroidered dress",
          price: 48,
          business_id: "business-1",
          business_name: "Barrio Threads",
          photo_url: JSON.stringify(["https://example.com/source.webp"]),
          photo_variants: [
            {
              id: "asset-1",
              original: { url: "https://example.com/source.webp", path: "source.webp" },
              variants: {
                thumb_320: "https://example.com/thumb_320.webp",
                card_640: "https://example.com/card_640.webp",
                detail_1200: "https://example.com/detail_1200.webp",
              },
              selectedVariant: "original",
            },
          ],
          cover_image_id: "asset-1",
          inventory_status: "in_stock",
          inventory_quantity: 1,
        }}
      />
    );

    const image = screen.getByAltText("Tall embroidered dress");
    expect(image).toHaveAttribute("src", "https://example.com/card_640.webp");
    expect(image).toHaveClass("object-contain", "object-center");
    expect(image).not.toHaveClass("object-cover");
  });

  it("keeps default marketplace listing images product-safe for homepage cards", () => {
    render(
      <ListingMarketplaceCard
        fallbackLocationLabel="Long Beach"
        listing={{
          id: "listing-home",
          public_id: "listing-home",
          title: "Portrait product photo",
          price: 32,
          business_id: "business-1",
          business_name: "Barrio Goods",
          photo_url: "https://example.com/product.jpg",
          inventory_status: "in_stock",
          inventory_quantity: 1,
        }}
      />
    );

    const image = screen.getByAltText("Portrait product photo");
    expect(image).toHaveClass("object-contain", "object-center");
    expect(image).not.toHaveClass("object-cover");
  });
});
