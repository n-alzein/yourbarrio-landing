import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Footer from "@/components/Footer";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("next/image", () => ({
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} />;
  },
}));

describe("Footer legal links", () => {
  it("separates company and legal links with one business CTA", () => {
    render(<Footer className="mt-0" />);

    expect(screen.getByText("Company")).toBeInTheDocument();
    expect(screen.getByText("Legal")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Business Terms" })).toHaveAttribute("href", "/business-terms");
    expect(screen.getByRole("link", { name: "Category Policy" })).toHaveAttribute(
      "href",
      "/prohibited-categories"
    );

    expect(screen.getAllByRole("link", { name: "YourBarrio for Business" })).toHaveLength(1);
  });
});
