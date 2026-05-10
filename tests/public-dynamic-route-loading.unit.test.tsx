import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import PublicBusinessProfileLoading from "@/app/(public)/(marketing)/b/[id]/loading";
import ListingDetailsLoading from "@/app/(public)/listings/[id]/loading";

const publicListingsLoadingSource = readFileSync(
  path.join(process.cwd(), "app/(public)/listings/loading.js"),
  "utf8"
);

describe("public dynamic route loading UI", () => {
  afterEach(() => {
    cleanup();
  });

  it("does not render visible route-level loading UI for listing detail navigations", () => {
    const { container } = render(<ListingDetailsLoading />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/loading listing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/getting the latest details/i)).not.toBeInTheDocument();
  });

  it("does not render visible route-level loading UI for public business profile navigations", () => {
    const { container } = render(<PublicBusinessProfileLoading />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("public-business-profile-skeleton")).not.toBeInTheDocument();
  });

  it("keeps the public listings index loading skeleton unchanged", () => {
    expect(publicListingsLoadingSource).toContain("ListingMarketplaceCardSkeleton");
    expect(publicListingsLoadingSource).toContain("LISTING_MARKETPLACE_GRID_CLASS");
    expect(publicListingsLoadingSource).toContain("Array.from({ length: 10 })");
  });
});
