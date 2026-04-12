import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BusinessListingsGrid from "@/components/publicBusinessProfile/BusinessListingsGrid";

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/FastImage", () => ({
  __esModule: true,
  default: ({ alt, fill, priority, sizes, decoding, ...rest }) => <img alt={alt} {...rest} />,
}));

const listings = [
  {
    id: "listing-1",
    title: "Cold Brew Concentrate",
    price: 12,
    category: "food-beverage",
    city: "Los Angeles",
    photo_url: "/cold-brew.jpg",
    public_id: "listing-1",
  },
  {
    id: "listing-2",
    title: "Pan Dulce Box",
    price: 18,
    category: "food-beverage",
    city: "Los Angeles",
    photo_url: "/pan-dulce.jpg",
    public_id: "listing-2",
  },
];

describe("BusinessListingsGrid", () => {
  it("renders listings in a single-row snap carousel without changing links", () => {
    const { container } = render(
      <BusinessListingsGrid
        listings={listings}
        itemHrefResolver={(item) => `/listings/${item.public_id}`}
      />
    );

    const carousel = container.querySelector(".overflow-x-auto");
    expect(carousel).toBeInTheDocument();
    expect(carousel).toHaveClass("flex", "snap-x", "snap-mandatory");

    const cards = screen.getAllByRole("link");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveAttribute("href", "/listings/listing-1");
    expect(cards[1]).toHaveAttribute("href", "/listings/listing-2");
    expect(cards[0]).toHaveClass("shrink-0", "snap-start");
    expect(cards[0].className).toContain("w-[calc((100%-1rem)/2)]");
    expect(cards[0].className).toContain("sm:w-[18.5rem]");
  });
});
