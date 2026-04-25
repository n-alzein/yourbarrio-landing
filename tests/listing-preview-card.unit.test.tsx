import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ListingPreviewCard from "@/components/business/listings/ListingPreviewCard";

describe("ListingPreviewCard", () => {
  it("renders title, price, cover image, and availability from form state", () => {
    render(
      <ListingPreviewCard
        title="Cold brew concentrate"
        price="12.5"
        category="Drinks"
        imageUrl="https://example.com/cover.jpg"
        inventoryStatus="in_stock"
        inventoryQuantity={8}
        lowStockThreshold={3}
      />
    );

    expect(screen.getByText("Cold brew concentrate")).toBeInTheDocument();
    expect(screen.getByText("$12.50")).toBeInTheDocument();
    expect(screen.getByText("Drinks")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.getByText("8 available right now.")).toBeInTheDocument();
    expect(screen.getByAltText("Cold brew concentrate")).toHaveAttribute(
      "src",
      "https://example.com/cover.jpg"
    );
    expect(screen.getByAltText("Cold brew concentrate").className).toContain("object-contain");
  });

  it("uses a readable light-purple active state for preview variant selection", () => {
    render(
      <ListingPreviewCard
        title="Crewneck"
        price="28"
        category="Apparel"
        imageUrl="https://example.com/cover.jpg"
        inventoryStatus="in_stock"
        inventoryQuantity={8}
        lowStockThreshold={2}
        variants={[
          { id: "s", options: { Size: "S" }, quantity: 3, is_active: true, price: null },
          { id: "m", options: { Size: "M" }, quantity: 5, is_active: true, price: null },
        ]}
      />
    );

    const selectedVariant = screen.getByRole("button", { name: "S" });
    expect(selectedVariant.className).toContain("bg-violet-100");
    expect(selectedVariant.className).toContain("text-violet-800");

    fireEvent.click(screen.getByRole("button", { name: "M" }));
    expect(screen.getByRole("button", { name: "M" }).className).toContain("bg-violet-100");
  });
});
