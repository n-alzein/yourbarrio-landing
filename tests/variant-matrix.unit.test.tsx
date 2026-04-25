import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import VariantMatrix from "@/components/business/listings/VariantMatrix";

const variants = [
  {
    id: "v1",
    quantity: 3,
    price: null,
    sku: "",
    options: { Size: "S" },
  },
];

describe("VariantMatrix", () => {
  it("preserves compact quantity editing", () => {
    const onChange = vi.fn();
    render(<VariantMatrix variants={variants} onChange={onChange} errors={{}} basePrice="12.50" />);

    fireEvent.change(screen.getByDisplayValue("3"), { target: { value: "7" } });

    expect(onChange).toHaveBeenCalledWith(
      0,
      expect.objectContaining({
        quantity: "7",
      })
    );
  });

  it("seeds price override from the base price when empty", () => {
    const onChange = vi.fn();
    render(<VariantMatrix variants={variants} onChange={onChange} errors={{}} basePrice="12.50" />);

    fireEvent.focus(screen.getByPlaceholderText("Use base price"));

    expect(onChange).toHaveBeenCalledWith(
      0,
      expect.objectContaining({
        price: 12.5,
      })
    );
  });
});
