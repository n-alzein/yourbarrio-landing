import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SafeAvatar from "@/components/SafeAvatar";
import { getAvatarInitials } from "@/lib/avatarInitials";

describe("getAvatarInitials", () => {
  it("uses first and last word initials for full names", () => {
    expect(getAvatarInitials({ fullName: "Test Account" })).toBe("TA");
    expect(getAvatarInitials({ fullName: "  Nour  Example  User " })).toBe("NU");
  });

  it("uses one letter for single-word names", () => {
    expect(getAvatarInitials({ displayName: "Nour" })).toBe("N");
  });

  it("uses the first alphabetic local-part character for email fallback", () => {
    expect(getAvatarInitials({ email: "faketest@test.com" })).toBe("F");
    expect(getAvatarInitials({ email: "123.nour@test.com" })).toBe("N");
  });

  it("skips punctuation and number-only values", () => {
    expect(getAvatarInitials({ fullName: "1234", displayName: "!!!" })).toBe("");
  });
});

describe("SafeAvatar", () => {
  it("renders initials when no avatar source exists", () => {
    render(<SafeAvatar src="" fullName="Test Account" alt="Profile avatar" />);

    expect(screen.getByRole("img", { name: "Profile avatar" })).toHaveAttribute(
      "data-avatar-fallback",
      "initials"
    );
    expect(screen.getByText("TA")).toBeInTheDocument();
  });

  it("falls back to initials when the image fails to load", () => {
    render(
      <SafeAvatar
        src="https://example.com/broken.jpg"
        fullName="Test Account"
        alt="Profile avatar"
      />
    );

    fireEvent.error(screen.getByAltText("Profile avatar"));

    expect(screen.getByRole("img", { name: "Profile avatar" })).toHaveAttribute(
      "data-avatar-fallback",
      "initials"
    );
    expect(screen.getByText("TA")).toBeInTheDocument();
  });

  it("uses business initials in a rounded-square fallback for business avatars", () => {
    render(
      <SafeAvatar
        src=""
        businessName="Test Bakery"
        displayName="Nour"
        email="owner@test.com"
        identityType="business"
        shape="rounded-square"
        alt="Business avatar"
      />
    );

    const avatar = screen.getByRole("img", { name: "Business avatar" });
    expect(screen.getByText("TB")).toBeInTheDocument();
    expect(avatar).toHaveStyle({ borderRadius: "1rem" });
  });
});
