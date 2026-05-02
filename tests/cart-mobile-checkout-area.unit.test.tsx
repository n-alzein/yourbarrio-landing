import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CartPageClient from "@/app/cart/CartPageClient";

const longBusinessName =
  "Fashion Corner With An Extra Long Neighborhood Boutique Name";

const mockOpenModal = vi.fn();
const mockUpdateItem = vi.fn();
const mockRemoveItem = vi.fn();
const mockSetFulfillmentType = vi.fn();

let mockUser: { id: string } | null = { id: "customer-1" };

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, prefetch, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/SafeImage", () => ({
  __esModule: true,
  default: ({ alt, useNextImage, ...rest }) => <img alt={alt} {...rest} />,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock("@/components/modals/ModalProvider", () => ({
  useModal: () => ({ openModal: mockOpenModal }),
}));

vi.mock("@/lib/auth/useCurrentAccountContext", () => ({
  useCurrentAccountContext: () => ({
    purchaseRestricted: false,
    rolePending: false,
  }),
}));

vi.mock("@/components/cart/CartProvider", () => ({
  useCart: () => ({
    items: [
      {
        id: "cart-item-1",
        listing_id: "listing-1",
        title: "Linen jacket",
        quantity: 1,
        unit_price: 23,
        image_url: null,
        max_order_quantity: 10,
      },
    ],
    vendorGroups: [
      {
        business_id: "vendor-1",
        business_name: longBusinessName,
        cart_id: "cart-1",
        item_count: 1,
        subtotal: 23,
        fulfillment_type: "pickup",
        available_fulfillment_methods: ["pickup"],
        items: [
          {
            id: "cart-item-1",
            listing_id: "listing-1",
            title: "Linen jacket",
            quantity: 1,
            unit_price: 23,
            image_url: null,
            max_order_quantity: 10,
          },
        ],
      },
    ],
    loading: false,
    error: null,
    updateItem: mockUpdateItem,
    removeItem: mockRemoveItem,
    setFulfillmentType: mockSetFulfillmentType,
  }),
}));

describe("CartPageClient mobile checkout area", () => {
  beforeEach(() => {
    mockUser = { id: "customer-1" };
    mockOpenModal.mockClear();
    mockUpdateItem.mockClear();
    mockRemoveItem.mockClear();
    mockSetFulfillmentType.mockClear();
  });

  it("stacks vendor subtotal above a full-width wrapping checkout CTA for long business names", () => {
    render(<CartPageClient />);

    const checkoutArea = screen.getByTestId("cart-vendor-checkout-area-vendor-1");
    const subtotalRow = screen.getByTestId("cart-vendor-subtotal-row-vendor-1");
    const checkoutButton = screen.getByTestId("cart-vendor-checkout-button-vendor-1");

    expect(screen.getByText(longBusinessName)).toHaveClass("break-words");
    expect(subtotalRow).toHaveTextContent("Vendor subtotal");
    expect(subtotalRow).toHaveTextContent("$23.00");

    expect(checkoutArea).toHaveClass("flex-col", "md:flex-row", "min-w-0");
    expect(subtotalRow).toHaveClass("w-full", "justify-between", "min-w-0");
    expect(checkoutButton).toHaveClass(
      "mt-3",
      "w-full",
      "min-w-0",
      "whitespace-normal",
      "leading-tight",
      "md:mt-0",
      "md:w-auto"
    );
    expect(checkoutButton).toHaveTextContent(`Checkout with ${longBusinessName}`);
  });
});
