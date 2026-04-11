import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CategoryTilesGrid from "@/components/customer/CategoryTilesGrid";

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, prefetch, onNavigate, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt, fill, priority, ...rest }) => <img alt={alt} {...rest} />,
}));

describe("CategoryTilesGrid", () => {
  it("renders category tiles with links", () => {
    render(
      <CategoryTilesGrid
        categories={[
          {
            id: 1,
            name: "Electronics & Tech",
            slug: "electronics-tech",
            tileImageUrl: "/electronics-tech.png",
          },
          {
            id: 2,
            name: "Home & Decor",
            slug: "home-decor",
            tileImageUrl: "/home-decor.png",
          },
        ]}
      />
    );

    expect(screen.getByText("Electronics & Tech")).toBeInTheDocument();
    expect(screen.getByText("Home & Decor")).toBeInTheDocument();
    expect(screen.getByLabelText("Shop Electronics & Tech")).toHaveAttribute(
      "href",
      "/categories/electronics-tech"
    );
    expect(screen.getByLabelText("Shop Home & Decor")).toHaveAttribute(
      "href",
      "/categories/home-decor"
    );
  });

  it("shows empty state when no categories", () => {
    render(<CategoryTilesGrid categories={[]} />);
    expect(screen.getByText("No categories yet.")).toBeInTheDocument();
  });
});
