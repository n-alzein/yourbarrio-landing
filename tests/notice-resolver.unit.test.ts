import { describe, expect, it } from "vitest";
import { resolveNotices } from "@/lib/notices/resolve-notices";

const user = { id: "user-1", email: "customer@example.com" };
const completeProfile = {
  id: "user-1",
  role: "customer",
  full_name: "Nour Customer",
  phone: "(562) 123-4567",
  address: "123 Main St",
  city: "Long Beach",
  state: "CA",
  postal_code: "90802",
};

describe("resolveNotices", () => {
  it("generates name and phone copy when full name and phone are missing", () => {
    expect(
      resolveNotices({
        user,
        role: "customer",
        pathname: "/nearby",
        profile: {
          ...completeProfile,
          full_name: "",
          phone: "",
        },
      })
    ).toMatchObject({
      id: "customer-profile-completion:user-1",
      variant: "profile",
      title: "Finish setting up your account",
      message: "Add your name and phone for faster checkout and pickup coordination.",
      mobileTitle: "Finish your account",
      mobileMessage: "Add missing details for faster checkout.",
      mobileCtaLabel: "Add details",
      ctaHref: "/customer/settings?complete=profile",
      ctaLabel: "Add details",
      sticky: false,
    });
  });

  it("generates address-specific copy when only address is missing", () => {
    expect(
      resolveNotices({
        user,
        role: "customer",
        pathname: "/nearby",
        profile: {
          ...completeProfile,
          address: "",
          city: "",
          state: "",
          postal_code: "",
        },
      })
    ).toMatchObject({
      id: "customer-profile-completion:user-1",
      title: "Save your address",
      message: "Make checkout faster and improve nearby recommendations.",
      mobileTitle: "Save your address",
      mobileMessage: "Make checkout faster.",
      mobileCtaLabel: "Add address",
      ctaHref: "/customer/settings?complete=profile",
      ctaLabel: "Add address",
      sticky: false,
    });
  });

  it("avoids repeating add-address wording between title and CTA", () => {
    const notice = resolveNotices({
      user,
      role: "customer",
      pathname: "/nearby",
      profile: {
        ...completeProfile,
        address: "",
        city: "",
        state: "",
        postal_code: "",
      },
    });

    expect(notice).toMatchObject({
      title: "Save your address",
      ctaLabel: "Add address",
    });
    expect(notice?.title).not.toBe("Add your address");
    expect(notice?.title).not.toBe(notice?.ctaLabel);
  });

  it("generates phone-specific copy when only phone is missing", () => {
    expect(
      resolveNotices({
        user,
        role: "customer",
        pathname: "/nearby",
        profile: {
          ...completeProfile,
          phone: "",
        },
      })
    ).toMatchObject({
      title: "Add a phone number",
      message: "Help local shops coordinate pickup if needed.",
      mobileTitle: "Add a phone number",
      mobileMessage: "Help with pickup coordination.",
      mobileCtaLabel: "Add phone",
      ctaHref: "/customer/settings?complete=profile",
      ctaLabel: "Add phone",
    });
  });

  it("generates name-specific copy when only full name is missing", () => {
    expect(
      resolveNotices({
        user,
        role: "customer",
        pathname: "/nearby",
        profile: {
          ...completeProfile,
          full_name: "",
        },
      })
    ).toMatchObject({
      title: "Add your name",
      message: "Help local shops know who they're helping with orders and messages.",
      mobileTitle: "Add your name",
      mobileMessage: "Personalize your account.",
      mobileCtaLabel: "Add name",
      ctaHref: "/customer/settings?complete=profile",
      ctaLabel: "Save name",
    });
  });

  it("generates all-fields copy when name, phone, and address are missing", () => {
    expect(
      resolveNotices({
        user,
        role: "customer",
        pathname: "/nearby",
        profile: {
          id: "user-1",
          role: "customer",
          full_name: "",
          phone: "",
        },
      })
    ).toMatchObject({
      title: "Finish setting up your account",
      message: "Add your name, phone, and address for faster checkout and pickup coordination.",
      mobileTitle: "Finish your account",
      mobileMessage: "Add missing details for faster checkout.",
      mobileCtaLabel: "Add details",
      ctaHref: "/customer/settings?complete=profile",
      ctaLabel: "Add details",
    });
  });

  it("returns no profile notice for complete customer profile", () => {
    expect(
      resolveNotices({
        user,
        role: "customer",
        pathname: "/nearby",
        profile: completeProfile,
      })
    ).toBeNull();
  });

  it("returns no profile notice on customer settings", () => {
    expect(
      resolveNotices({
        user,
        role: "customer",
        pathname: "/customer/settings",
        profile: { id: "user-1", role: "customer" },
      })
    ).toBeNull();
  });

  it("returns no profile notice on checkout", () => {
    expect(
      resolveNotices({
        user,
        role: "customer",
        pathname: "/checkout",
        profile: { id: "user-1", role: "customer" },
      })
    ).toBeNull();
  });

  it("returns highest priority notice when multiple notices exist", () => {
    expect(
      resolveNotices({
        user,
        role: "customer",
        pathname: "/nearby",
        profile: { id: "user-1", role: "customer" },
        extraNotices: [
          {
            id: "critical-security",
            variant: "critical",
            priority: 100,
            audience: "customer",
            message: "Review your account security.",
          },
        ],
      })
    ).toMatchObject({
      id: "critical-security",
      priority: 100,
    });
  });
});
