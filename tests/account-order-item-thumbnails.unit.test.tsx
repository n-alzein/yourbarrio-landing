import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import OrderItemThumbnails from "@/app/account/orders/OrderItemThumbnails";
import {
  getOrderItemThumbnailUrl,
  getOrderThumbnailItems,
} from "@/lib/orders/itemThumbnails";

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt, width, height, sizes, loading, className }) => (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      loading={loading}
      className={className}
    />
  ),
}));

describe("order item thumbnails", () => {
  it("uses listing photo priority before order item snapshot", () => {
    expect(
      getOrderItemThumbnailUrl({
        image_url: "https://example.com/snapshot.jpg",
        listing: {
          main_photo_url: "https://example.com/main.jpg",
          photos: ["https://example.com/first.jpg"],
        },
      })
    ).toBe("https://example.com/main.jpg");

    expect(
      getOrderItemThumbnailUrl({
        image_url: "https://example.com/snapshot.jpg",
        listing: {
          photos: ["https://example.com/first.jpg"],
        },
      })
    ).toBe("https://example.com/first.jpg");
  });

  it("shows up to three deterministic item images with an overflow item count", () => {
    const order = {
      id: "order-1",
      order_items: [5, 2, 4, 1, 3].map((index) => ({
        id: `item-${index}`,
        image_url: `https://example.com/item-${index}.jpg`,
        created_at: `2026-04-19T10:0${index}:00.000Z`,
        listing: null,
      })),
    };

    const { items, overflowCount } = getOrderThumbnailItems(order);

    expect(items).toHaveLength(3);
    expect(overflowCount).toBe(2);
    expect(items.map((item) => item.key)).toEqual(["item-1", "item-2", "item-3"]);

    const { container } = render(<OrderItemThumbnails order={order} />);
    const images = Array.from(container.querySelectorAll("img"));
    expect(images).toHaveLength(3);
    expect(images.map((image) => image.getAttribute("src"))).toEqual([
      "https://example.com/item-1.jpg",
      "https://example.com/item-2.jpg",
      "https://example.com/item-3.jpg",
    ]);
    expect(screen.getByText("+2 items")).toBeInTheDocument();
  });

  it("does not show an overflow count for three or fewer items", () => {
    render(
      <OrderItemThumbnails
        order={{
          id: "order-small",
          order_items: [1, 2, 3].map((index) => ({
            id: `item-${index}`,
            image_url: `https://example.com/item-${index}.jpg`,
            listing: null,
          })),
        }}
      />
    );

    expect(screen.queryByText(/\+\d+ items/)).not.toBeInTheDocument();
  });

  it("keeps large orders compact with a large overflow count", () => {
    const { container } = render(
      <OrderItemThumbnails
        order={{
          id: "order-large",
          order_items: Array.from({ length: 20 }, (_, index) => ({
            id: `item-${String(index + 1).padStart(2, "0")}`,
            image_url: `https://example.com/item-${index + 1}.jpg`,
            listing: null,
          })),
        }}
      />
    );

    expect(container.querySelectorAll("img")).toHaveLength(3);
    expect(screen.getByText("+17 items")).toBeInTheDocument();
  });

  it("renders a fixed-size placeholder when item images are missing", () => {
    const { container } = render(
      <OrderItemThumbnails
        order={{
          id: "order-2",
          order_items: [{ id: "item-1", image_url: null, listing: null }],
        }}
      />
    );

    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(container.querySelector(".h-12.w-12")).toBeInTheDocument();
  });
});
