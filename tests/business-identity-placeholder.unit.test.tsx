import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BusinessIdentityPlaceholder from "@/components/business/BusinessIdentityPlaceholder";

describe("BusinessIdentityPlaceholder wordmark", () => {
  it("renders short two-word names as a two-line wordmark", () => {
    render(
      <BusinessIdentityPlaceholder
        business={{ business_name: "Silver Lagoon" }}
        variant="wordmark"
      />
    );

    expect(screen.getByText("Silver")).toBeInTheDocument();
    expect(screen.getByText("Lagoon")).toBeInTheDocument();
  });

  it("reduces longer names to two meaningful words", () => {
    render(
      <BusinessIdentityPlaceholder
        business={{ business_name: "AI Shorter Smoke" }}
        variant="wordmark"
      />
    );

    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("Smoke")).toBeInTheDocument();
    expect(screen.queryByText("Shorter")).not.toBeInTheDocument();
  });

  it("falls back to initials when selected words are too long", () => {
    render(
      <BusinessIdentityPlaceholder
        business={{ business_name: "The Supercalifragilistic Collective" }}
        variant="wordmark"
      />
    );

    expect(screen.getByText("TC")).toBeInTheDocument();
    expect(screen.queryByText("Supercalifragilistic")).not.toBeInTheDocument();
  });
});
