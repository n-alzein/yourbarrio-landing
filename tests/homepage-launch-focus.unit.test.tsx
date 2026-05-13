import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

const locationMock = vi.hoisted(() => ({
  current: { city: "Long Beach", region: "CA", lat: 33.7701, lng: -118.1937 },
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt, ...rest }: any) => <img alt={alt} {...rest} />,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/lib/listingPhotos", () => ({
  resolveListingCardImageUrl: () => null,
  resolveListingCoverImageUrl: () => null,
}));

vi.mock("@/lib/taxonomy/placeholders", () => ({
  getListingCategoryPlaceholder: () => "/placeholder.png",
}));

vi.mock("@/lib/ids/publicRefs", () => ({
  getCustomerListingUrl: (listing: any) => `/customer/listings/${listing.public_id || listing.id}`,
  getListingUrl: (listing: any) => `/listings/${listing.public_id || listing.id}`,
}));

vi.mock("@/components/location/LocationProvider", () => ({
  useLocation: () => ({
    location: locationMock.current,
    hydrated: true,
  }),
}));

vi.mock("@/components/cards/BusinessCard", () => ({
  __esModule: true,
  default: ({ business }: any) => <div>{business.business_name}</div>,
}));

import TrendingListingsSection from "@/components/home/TrendingListingsSection";
import PopularNearYouSection from "@/components/home/PopularNearYouSection";

const customerHomeSource = readFileSync(
  path.join(process.cwd(), "app/(customer)/customer/home/CustomerHomeClient.jsx"),
  "utf8"
);
function makeListings(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `listing-${index + 1}`,
    public_id: `listing-${index + 1}`,
    title: `Listing ${index + 1}`,
    description: null,
    price: 20 + index,
    category: "Clothing & Fashion",
    category_id: null,
    city: "Long Beach",
    photo_url: null,
    business_id: `business-${index + 1}`,
    business_name: `Shop ${index + 1}`,
    created_at: `2026-04-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
    inventory_status: "in_stock",
    inventory_quantity: 5,
    low_stock_threshold: 2,
    inventory_last_updated_at: "2026-04-26T12:00:00.000Z",
  }));
}

describe("homepage launch focus", () => {
  beforeEach(() => {
    locationMock.current = { city: "Long Beach", region: "CA", lat: 33.7701, lng: -118.1937 };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          businesses: [
            { public_id: "business-1", business_name: "Shop One", verification_status: "auto_verified" },
            { public_id: "business-2", business_name: "Shop Two", verification_status: "auto_verified" },
          ],
        }),
      })
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("uses curated listing copy when few listings are available", () => {
    render(<TrendingListingsSection listings={makeListings(5)} city="Long Beach" />);

    expect(screen.getByText("Featured in Long Beach")).toBeInTheDocument();
    expect(screen.queryByText("Handpicked local finds near you")).not.toBeInTheDocument();
    expect(
      screen.queryByText("YourBarrio is starting with a curated group of Long Beach shops.")
    ).not.toBeInTheDocument();
  });

  it("keeps the featured title as inventory grows", () => {
    render(<TrendingListingsSection listings={makeListings(10)} city="Long Beach" />);

    expect(screen.getByText("Featured in Long Beach")).toBeInTheDocument();
  });

  it("updates the featured title and view-all href for a selected city", () => {
    locationMock.current = { city: "Costa Mesa", region: "CA", lat: 33.6411, lng: -117.9187 };

    render(<TrendingListingsSection listings={makeListings(3)} city="Costa Mesa" />);

    expect(screen.getByText("Featured in Costa Mesa")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view all listings/i })).toHaveAttribute(
      "href",
      expect.stringContaining("city=Costa+Mesa")
    );
    expect(screen.getByRole("link", { name: /view all listings/i })).toHaveAttribute(
      "href",
      expect.stringContaining("state=CA")
    );
    expect(screen.getByRole("link", { name: /view all listings/i })).toHaveAttribute(
      "href",
      expect.stringContaining("lat=33.6411")
    );
  });

  it("caps the home listings grid at two desktop rows worth of cards", () => {
    render(<TrendingListingsSection listings={makeListings(24)} city="Long Beach" limit={8} />);

    expect(screen.getByText("Featured in Long Beach")).toBeInTheDocument();
    expect(screen.getByTestId("homepage-listings-grid")).toBeInTheDocument();
    expect(screen.getAllByRole("link").filter((node) => node.getAttribute("href")?.startsWith("/listings/"))).toHaveLength(8);
  });

  it("adds a secondary fresh-finds listing section", () => {
    render(
      <TrendingListingsSection
        listings={makeListings(6)}
        city="Long Beach"
        limit={4}
        variant="new"
        excludeListingIds={["listing-1", "listing-2"]}
      />
    );

    expect(screen.getByText("Recently added")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fresh finds" })).toBeInTheDocument();
    expect(screen.getAllByText("Fresh finds")).toHaveLength(1);
    expect(screen.queryByText("Freshly added items from nearby shops")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link").filter((node) => node.getAttribute("href")?.startsWith("/listings/"))).toHaveLength(4);
  });

  it("fills the fresh-finds row from non-featured listings when launch inventory allows it", () => {
    render(
      <TrendingListingsSection
        listings={makeListings(13)}
        city="Long Beach"
        limit={8}
        minItems={5}
        variant="new"
        excludeListingIds={makeListings(8).map((listing) => listing.public_id)}
      />
    );

    const listingLinks = screen
      .getAllByRole("link")
      .filter((node) => node.getAttribute("href")?.startsWith("/listings/"));
    expect(listingLinks).toHaveLength(5);
    expect(listingLinks.map((node) => node.getAttribute("href"))).toEqual([
      "/listings/listing-9",
      "/listings/listing-10",
      "/listings/listing-11",
      "/listings/listing-12",
      "/listings/listing-13",
    ]);
  });

  it("backfills fresh finds without duplicate cards when non-featured inventory is short", () => {
    render(
      <TrendingListingsSection
        listings={makeListings(11)}
        city="Long Beach"
        limit={8}
        minItems={5}
        variant="new"
        excludeListingIds={makeListings(8).map((listing) => listing.public_id)}
      />
    );

    const hrefs = screen
      .getAllByRole("link")
      .filter((node) => node.getAttribute("href")?.startsWith("/listings/"))
      .map((node) => node.getAttribute("href"));
    expect(hrefs).toHaveLength(5);
    expect(new Set(hrefs).size).toBe(5);
    expect(hrefs.slice(0, 3)).toEqual([
      "/listings/listing-9",
      "/listings/listing-10",
      "/listings/listing-11",
    ]);
    expect(hrefs.slice(3)).not.toEqual(["/listings/listing-1", "/listings/listing-2"]);
  });

  it("keeps the homepage business title launch-appropriate", async () => {
    render(
      <PopularNearYouSection
        title="Local shops in Long Beach"
        limit={6}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Local shops in Long Beach")).toBeInTheDocument();
    });
  });

  it("removes the category section from the homepage client", () => {
    expect(customerHomeSource).not.toContain("Browse by category");
    expect(customerHomeSource).not.toContain("CategoryTilesGrid");
  });

  it("does not retain stale home listings when a selected-location request is empty", () => {
    expect(customerHomeSource).not.toContain("nextListings.length > 0 ? nextListings : current");
    expect(customerHomeSource).toContain("setHomeListings(nextListings)");
  });

  it("keeps customer-home listing thumbnails product-safe", () => {
    expect(customerHomeSource).toContain("bg-white object-contain object-center");
    expect(customerHomeSource).not.toContain("h-20 w-20 object-cover");
  });

  it("keeps the business section copy aligned to the launch brief", async () => {
    render(
      <PopularNearYouSection
        title="Local shops in Long Beach"
        subtitle="Meet the local storefronts behind these finds"
        limit={6}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Local shops in Long Beach")).toBeInTheDocument();
    });

    expect(screen.getByText("Meet the local storefronts behind these finds")).toBeInTheDocument();
  });
});
