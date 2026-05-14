import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BusinessTermsPage, {
  metadata as businessTermsMetadata,
} from "@/app/(public)/(marketing)/business-terms/page.jsx";
import ProhibitedCategoriesPage, {
  metadata as prohibitedCategoriesMetadata,
} from "@/app/(public)/(marketing)/prohibited-categories/page.jsx";
import TermsPage, {
  metadata as termsMetadata,
} from "@/app/(public)/(marketing)/terms/page.jsx";

const termsSource = readFileSync(
  path.join(process.cwd(), "app/(public)/(marketing)/terms/page.jsx"),
  "utf8"
);
const onboardingSource = readFileSync(
  path.join(process.cwd(), "app/(onboarding)/onboarding/OnboardingClient.jsx"),
  "utf8"
);
const newListingSource = readFileSync(
  path.join(process.cwd(), "app/(business)/business/listings/new/page.jsx"),
  "utf8"
);
const editListingSource = readFileSync(
  path.join(process.cwd(), "app/(business)/business/listings/[id]/edit/page.js"),
  "utf8"
);

describe("business policy pages", () => {
  it("renders the terms page as a legal document", () => {
    render(<TermsPage />);

    expect(screen.getByRole("heading", { name: "Terms of Service" })).toBeInTheDocument();
    expect(screen.getByText("Terms of Service · Updated May 2026")).toBeInTheDocument();
    expect(screen.getByText("Use YourBarrio responsibly")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contents" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Acceptance of these terms" })).toHaveAttribute(
      "href",
      "#acceptance"
    );
    expect(screen.getByRole("link", { name: "Contact us" })).toHaveAttribute(
      "href",
      "#contact-us"
    );
    expect(screen.getByRole("heading", { name: "5. Business owner responsibilities" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "15. Contact us" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Business Terms" })).toHaveAttribute(
      "href",
      "/business-terms"
    );
    expect(
      screen.getAllByRole("link", { name: "Prohibited & Restricted Categories Policy" }).some(
        (link) => link.getAttribute("href") === "/prohibited-categories"
      )
    ).toBe(true);
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy"
    );
    expect(screen.queryByText(/Privacy Policyoutlines/i)).not.toBeInTheDocument();
    expect(termsMetadata).toMatchObject({
      title: "Terms of Service | YourBarrio",
      description:
        "Terms of Service explaining the rules for using YourBarrio as a customer, visitor, account holder, or business owner.",
    });
  });

  it("renders the business terms page and metadata", () => {
    render(<BusinessTermsPage />);

    expect(
      screen.getByRole("heading", { name: "YourBarrio Business Terms" })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Business Terms/i).length).toBeGreaterThan(0);
    expect(
      screen
        .getAllByRole("link", { name: "Prohibited & Restricted Categories Policy" })
        .some((link) => link.getAttribute("href") === "/prohibited-categories")
    ).toBe(true);
    expect(
      screen.getByText(/is incorporated into these Business Terms by reference/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Payment provider requirements/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/This summary is not exhaustive\. YourBarrio may restrict other businesses/i)
    ).toBeInTheDocument();
    expect(businessTermsMetadata).toMatchObject({
      title: "Business Terms | YourBarrio",
      description:
        "Business terms for shops, sellers, and service providers using YourBarrio.",
    });
  });

  it("renders the prohibited categories page and metadata", () => {
    render(<ProhibitedCategoriesPage />);

    expect(
      screen.getByRole("heading", { name: "Prohibited & Restricted Categories" })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "A. Prohibited" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "B. Restricted / Manual Review" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "C. Generally Allowed" })).toBeInTheDocument();
    expect(screen.getAllByText(/Prohibited & Restricted Categories/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Category").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Examples").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Notes").length).toBeGreaterThan(0);
    expect(screen.queryByText("Status")).not.toBeInTheDocument();
    expect(screen.getAllByText("Hazardous materials").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Live animals and pets").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tickets, reservations, and memberships").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Business Terms" })).toHaveAttribute(
      "href",
      "/business-terms"
    );
    expect(prohibitedCategoriesMetadata).toMatchObject({
      title: "Prohibited & Restricted Categories | YourBarrio",
      description:
        "Policy explaining which businesses, products, and services are prohibited or require review on YourBarrio.",
    });
  });

  it("links existing terms to business-specific policies", () => {
    expect(termsSource).toContain('href="/business-terms"');
    expect(termsSource).toContain('href="/prohibited-categories"');
    expect(termsSource).toContain('href="/privacy"');
    expect(termsSource).toContain("The Privacy Policy outlines");
    expect(termsSource).not.toContain("Privacy Policyoutlines");
  });

  it("surfaces business policy links in onboarding confirmation", () => {
    expect(onboardingSource).toContain("legalAccepted");
    expect(onboardingSource).toContain('href="/business-terms"');
    expect(onboardingSource).toContain('href="/terms"');
    expect(onboardingSource).toContain('href="/privacy"');
    expect(onboardingSource).toContain('href="/prohibited-categories"');
    expect(onboardingSource).toContain('target="_blank"');
    expect(onboardingSource).toContain('rel="noopener noreferrer"');
    expect(onboardingSource).toContain("business_terms_accepted:");
    expect(onboardingSource).toContain(
      "You need to confirm authorization and accept the required policies before continuing."
    );
    expect(onboardingSource).toContain(
      "I confirm I am authorized to create and manage this business on"
    );
  });

  it("surfaces prohibited categories guidance in listing create and edit flows", () => {
    for (const source of [newListingSource, editListingSource]) {
      expect(source).toContain("Some products and services cannot be listed on YourBarrio");
      expect(source).toContain('href="/prohibited-categories"');
      expect(source).toContain("Prohibited &amp; Restricted Categories Policy");
    }
  });
});
