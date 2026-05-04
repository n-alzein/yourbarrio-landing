import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OrderReceiptClient from "@/app/orders/[order_number]/OrderReceiptClient";

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, prefetch: _prefetch, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const baseOrder = {
  id: "order-1",
  order_number: "YB-WENBQJ",
  status: "confirmed",
  fulfillment_type: "pickup",
  pickup_time: "ASAP",
  subtotal: 22,
  fees: 2,
  total: 24,
  order_items: [
    {
      id: "item-1",
      title: "Long sleeve cotton shirt",
      listing_id: "listing-1",
      listing: { id: "listing-1" },
      quantity: 2,
      unit_price: 11,
      image_url: "https://example.com/shirt.jpg",
    },
  ],
};

const vendor = {
  id: "vendor-1",
  business_name: "Shoreline Market",
  city: "Long Beach",
};

describe("OrderReceiptClient", () => {
  it("renders a sidebar-free receipt with back navigation and order details", () => {
    const { container } = render(
      <OrderReceiptClient
        order={baseOrder as any}
        vendor={vendor as any}
        purchasedAtLabel="May 2, 2026, 6:00 AM"
        statusTimestampLabel="May 2, 2026, 6:05 AM"
        mode="details"
        backHref="/account/purchase-history"
      />
    );

    expect(screen.getByRole("link", { name: /back to orders/i })).toHaveAttribute(
      "href",
      "/account/purchase-history"
    );
    expect(screen.getByText("Order details")).toBeInTheDocument();
    expect(screen.getAllByText("Order YB-ORD-WENBQJ").length).toBeGreaterThan(0);
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Shoreline Market")).toBeInTheDocument();
    expect(screen.getByText("Pickup time: ASAP")).toBeInTheDocument();
    expect(screen.getByText("Long sleeve cotton shirt")).toBeInTheDocument();
    expect(screen.getByText("$24.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /print receipt/i })).toBeInTheDocument();
    expect(container.textContent).not.toContain("Account settings");
  });

  it("renders delivery address and instructions without right-floating layout text", () => {
    render(
      <OrderReceiptClient
        order={
          {
            ...baseOrder,
            fulfillment_type: "delivery",
            delivery_time: "ASAP",
            delivery_address1: "123 Pine St",
            delivery_address2: "Apt 4B",
            delivery_instructions: "Leave at the front desk.",
            delivery_fee_cents_snapshot: 500,
          } as any
        }
        vendor={vendor as any}
        purchasedAtLabel="May 2, 2026, 6:00 AM"
        statusTimestampLabel="May 2, 2026, 6:05 AM"
        mode="details"
      />
    );

    expect(screen.getByText("Delivery")).toBeInTheDocument();
    expect(screen.getByText("123 Pine St, Apt 4B")).toBeInTheDocument();
    expect(screen.getByText("Delivery instructions")).toBeInTheDocument();
    expect(screen.getByText("Leave at the front desk.")).toBeInTheDocument();
    expect(screen.getByText("$5.00")).toBeInTheDocument();
  });
});
