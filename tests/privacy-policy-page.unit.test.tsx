import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyPage, {
  metadata as privacyMetadata,
} from "@/app/(public)/(marketing)/privacy/page.jsx";

describe("privacy policy page", () => {
  it("renders the policy-grade privacy page and metadata", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeInTheDocument();
    expect(screen.getByText("Privacy first · Updated May 2026")).toBeInTheDocument();
    expect(screen.getByText("We do not sell personal data")).toBeInTheDocument();
    expect(screen.getByText("Location is optional")).toBeInTheDocument();
    expect(screen.getByText("You control your data")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Contents" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Information we collect" })
    ).toHaveAttribute("href", "#information-we-collect");
    expect(screen.getByRole("link", { name: "Contact us" })).toHaveAttribute(
      "href",
      "#contact-us"
    );

    expect(
      screen.getByRole("heading", { name: "1. Information we collect" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "11. Contact us" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/We do not sell personal data\. We share information only where needed/i)
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "support@yourbarrio.com" }).some(
        (link) => link.getAttribute("href") === "mailto:support@yourbarrio.com"
      )
    ).toBe(true);

    expect(privacyMetadata).toMatchObject({
      title: "Privacy Policy | YourBarrio",
      description:
        "Privacy policy explaining how YourBarrio collects, uses, shares, and protects marketplace information.",
    });
  });
});
