import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CategoryTilesGrid from "@/components/customer/CategoryTilesGrid";

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
  default: ({ alt, ...rest }) => <img alt={alt} {...rest} />,
}));

const tone = {
  base: "text-slate-900",
  soft: "text-slate-600",
  subtle: "text-slate-500",
};

describe("CategoryTilesGrid", () => {
  it("renders category tiles with links", () => {
    render(
      <CategoryTilesGrid
        textTone={tone}
        categories={[
          {
            id: 1,
            name: "Coffee",
            slug: "coffee",
            tileSubtitle: "Fresh brews",
            tileImageUrl: "/coffee.png",
          },
          {
            id: 2,
            name: "Groceries",
            slug: "groceries",
            tileSubtitle: null,
            tileImageUrl: "/groceries.png",
          },
        ]}
      />
    );

    expect(screen.getByText("Coffee")).toBeInTheDocument();
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links.length).toBe(2);
    expect(links[0].getAttribute("href")).toBe("/category/coffee");
    expect(links[1].getAttribute("href")).toBe("/category/groceries");
  });

  it("shows empty state when no categories", () => {
    render(<CategoryTilesGrid textTone={tone} categories={[]} />);
    expect(screen.getByText("No categories yet.")).toBeInTheDocument();
  });
});
