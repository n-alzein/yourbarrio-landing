import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthReturnPath,
  buildLoginHrefForReturnPath,
  ProfileHero,
} from "@/components/business/profile-system/ProfileSystem";
import PublicBusinessHero from "@/components/publicBusinessProfile/PublicBusinessHero";
import {
  getBusinessProfileShareUrl,
  shareBusinessProfile,
} from "@/lib/share/businessProfileShare";

const ProfileHeroAny = ProfileHero as any;
const PublicBusinessHeroAny = PublicBusinessHero as any;

let mockAuth = {
  user: null,
  role: null,
  supabase: null,
};

const pushMock = vi.fn();
const getOrCreateConversationMock = vi.fn();
const openModalMock = vi.fn();
const setAuthIntentMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  usePathname: () => "/b/shop-111",
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => mockAuth,
}));

vi.mock("@/components/modals/ModalProvider", () => ({
  useModal: () => ({ openModal: openModalMock }),
}));

vi.mock("@/lib/auth/authIntent", () => ({
  setAuthIntent: (...args) => setAuthIntentMock(...args),
}));

vi.mock("@/lib/messages", () => ({
  getOrCreateConversation: (...args) => getOrCreateConversationMock(...args),
}));

vi.mock("@/components/FastImage", () => ({
  __esModule: true,
  default: ({ alt, fallbackSrc, fill, priority, ...rest }) => <img alt={alt} {...rest} />,
}));

const profile = {
  id: "00000000-0000-0000-0000-000000000111",
  owner_user_id: "00000000-0000-0000-0000-000000000111",
  business_row_id: "business-row-111",
  public_id: "shop-111",
  business_name: "Barrio Boutique",
  business_type: "boutique",
  category: "boutique",
  city: "Los Angeles",
  state: "CA",
  address: "123 Main St",
  website: "barrioboutique.com",
  phone: "5551234567",
  hours_json: {
    mon: { open: "09:00", close: "17:00" },
    tue: { open: "09:00", close: "17:00" },
    wed: { open: "09:00", close: "17:00" },
    thu: { open: "09:00", close: "17:00" },
    fri: { open: "09:00", close: "17:00" },
  },
};

describe("ProfileHero preview actions", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    pushMock.mockReset();
    getOrCreateConversationMock.mockReset();
    openModalMock.mockReset();
    setAuthIntentMock.mockReset();
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(navigator, "canShare", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(window, "scrollTo", {
      value: vi.fn(),
      writable: true,
    });
    window.sessionStorage.clear();
    mockAuth = {
      user: null,
      role: null,
      supabase: null,
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds login hrefs that preserve the current route and query string", () => {
    expect(buildAuthReturnPath("/b/test-store", "")).toBe("/b/test-store");
    expect(buildAuthReturnPath("/customer/b/test-store", "")).toBe("/customer/b/test-store");
    expect(buildAuthReturnPath("/b/test-store", "preview=1&ref=qr")).toBe(
      "/b/test-store?preview=1&ref=qr"
    );
    expect(buildLoginHrefForReturnPath("/b/test-store")).toBe(
      "/login?next=%2Fb%2Ftest-store"
    );
    expect(buildLoginHrefForReturnPath("/customer/b/test-store")).toBe(
      "/login?next=%2Fcustomer%2Fb%2Ftest-store"
    );
    expect(buildLoginHrefForReturnPath("/b/test-store?preview=1&ref=qr")).toBe(
      "/login?next=%2Fb%2Ftest-store%3Fpreview%3D1%26ref%3Dqr"
    );
  });

  it("shows directions as the primary CTA and keeps guest messaging de-emphasized", () => {
    render(
      <ProfileHeroAny
        mode="preview"
        profile={profile}
        ratingSummary={{ count: 3, average: 4.7 }}
        publicPath="/b/shop-111"
      />
    );

    expect(screen.getByRole("link", { name: "Directions" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Website" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Call" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign in to message" }));
    expect(setAuthIntentMock).toHaveBeenCalledWith({
      redirectTo: "/b/shop-111",
      role: "customer",
    });
    expect(openModalMock).toHaveBeenCalledWith("customer-login", { next: "/b/shop-111" });
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Local business")).not.toBeInTheDocument();
    expect(screen.getAllByText("Los Angeles, CA")).toHaveLength(1);
    expect(screen.getByLabelText("Share")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toHaveAttribute("type", "button");
    expect(screen.getByTestId("profile-hero-cover")).toHaveAttribute(
      "data-business-cover-source",
      "defaultFallback"
    );
  });

  it("does not leak the owner back link into public hero renders by default", () => {
    render(
      <PublicBusinessHeroAny
        mode="public"
        profile={profile}
        ratingSummary={{ count: 3, average: 4.7 }}
        publicPath="/b/shop-111"
      />
    );

    expect(screen.queryByRole("link", { name: "Back to business profile" })).not.toBeInTheDocument();
  });

  it("keeps the owner preview back link behind an explicit preview flag", () => {
    render(
      <PublicBusinessHeroAny
        mode="public"
        profile={profile}
        ratingSummary={{ count: 3, average: 4.7 }}
        publicPath="/b/shop-111"
        showBackLink
      />
    );

    expect(screen.getByRole("link", { name: "Back to business profile" })).toHaveAttribute(
      "href",
      "/business/profile"
    );
  });

  it("scrolls to the reviews section from the header review summary", () => {
    render(
      <>
        <ProfileHeroAny
          mode="preview"
          profile={profile}
          ratingSummary={{ count: 3, average: 4.7 }}
          publicPath="/b/shop-111"
        />
        <section id="reviews">Reviews</section>
      </>
    );

    fireEvent.click(screen.getByRole("button", { name: "Jump to reviews" }));

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: -152,
      behavior: "smooth",
    });
  });

  it("keeps message subtle for logged-in customers and opens the conversation", async () => {
    mockAuth = {
      user: { id: "00000000-0000-0000-0000-000000000222" },
      role: "customer",
      supabase: { rpc: vi.fn() },
    };
    getOrCreateConversationMock.mockResolvedValue("conversation-123");

    render(
      <ProfileHeroAny
        mode="preview"
        profile={profile}
        ratingSummary={{ count: 3, average: 4.7 }}
        publicPath="/b/shop-111"
      />
    );

    expect(screen.getByRole("link", { name: "Directions" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Website" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Call" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Message" }));

    await waitFor(() => {
      expect(getOrCreateConversationMock).toHaveBeenCalledWith({
        supabase: mockAuth.supabase,
        businessId: "00000000-0000-0000-0000-000000000111",
      });
    });
    expect(pushMock).toHaveBeenCalledWith("/customer/messages/conversation-123");
  });

  it("keeps the public full-bleed mobile hero identity and actions mobile-scoped", () => {
    render(
      <PublicBusinessHeroAny
        mode="public"
        profile={profile}
        ratingSummary={{ count: 3, average: 4.7 }}
        publicPath="/b/shop-111"
        variant="publicFullBleed"
      />
    );

    const mobileIdentity = screen.getByTestId("profile-hero-mobile-identity");
    const desktopIdentity = screen.getByTestId("profile-hero-desktop-identity");

    expect(mobileIdentity).toHaveClass("md:hidden");
    expect(mobileIdentity).toHaveTextContent("Barrio Boutique");
    expect(
      mobileIdentity.querySelector("[data-business-avatar-placeholder]")
    ).toBeInTheDocument();
    expect(desktopIdentity).toHaveClass("hidden", "md:flex");
    expect(mobileIdentity.querySelector(".flex.items-end")).toBeInTheDocument();

    const mobileActions = mobileIdentity.querySelectorAll("a,button");
    expect(
      Array.from(mobileActions).map((node) => node.getAttribute("aria-label") || node.textContent)
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Directions"),
        expect.stringContaining("Website"),
        expect.stringContaining("Call"),
        "Save business",
        "Share",
        expect.stringContaining("Sign in to message"),
      ])
    );

    for (const label of ["Directions", "Website", "Call"]) {
      const action = mobileIdentity.querySelector(`[aria-label="${label}"]`);
      expect(action).toBeInTheDocument();
      expect(action).toHaveClass("h-11", "w-11", "md:w-auto");
      expect(action?.querySelector("span")).toHaveClass("sr-only", "md:not-sr-only");
    }
  });

  it("uses native sharing for the public business profile URL when available", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://yourbarrio.com");
    const shareMock = vi.fn().mockResolvedValue(undefined);
    const clipboardMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: shareMock,
      configurable: true,
    });
    Object.defineProperty(navigator, "canShare", {
      value: vi.fn(() => true),
      configurable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: clipboardMock },
      configurable: true,
    });

    render(
      <ProfileHeroAny
        mode="preview"
        profile={profile}
        ratingSummary={{ count: 3, average: 4.7 }}
        publicPath="/b/shop-111"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => {
      expect(shareMock).toHaveBeenCalledWith({
        title: "Barrio Boutique",
        text: "Check out Barrio Boutique on YourBarrio.",
        url: "https://yourbarrio.com/b/shop-111",
      });
    });
    expect(clipboardMock).not.toHaveBeenCalled();
    expect(await screen.findByText("Shared")).toBeInTheDocument();
  });

  it("falls back to copying the public profile URL when native sharing is unavailable", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://yourbarrio.com");
    const clipboardMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: clipboardMock },
      configurable: true,
    });

    render(
      <ProfileHeroAny
        mode="preview"
        profile={profile}
        ratingSummary={{ count: 3, average: 4.7 }}
        publicPath="/b/shop-111"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => {
      expect(clipboardMock).toHaveBeenCalledWith("https://yourbarrio.com/b/shop-111");
    });
    expect(await screen.findByText("Link copied")).toBeInTheDocument();
  });

  it("does not show an error or copy fallback for normal native share cancellation", async () => {
    const clipboardMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: vi.fn().mockRejectedValue(new DOMException("Share canceled", "AbortError")),
      configurable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: clipboardMock },
      configurable: true,
    });

    render(
      <ProfileHeroAny
        mode="preview"
        profile={profile}
        ratingSummary={{ count: 3, average: 4.7 }}
        publicPath="/b/shop-111"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => {
      expect(navigator.share).toHaveBeenCalled();
    });
    expect(clipboardMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Couldn't share. Copy the URL from your browser.")).not.toBeInTheDocument();
  });
});

describe("business profile share utility", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("generates an absolute public business profile URL from the configured site origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://yourbarrio.com");

    expect(getBusinessProfileShareUrl("/b/shop-111")).toBe(
      "https://yourbarrio.com/b/shop-111"
    );
  });

  it("returns copied when native sharing is unavailable but clipboard succeeds", async () => {
    const navigatorRef = {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    } as unknown as Navigator;

    await expect(
      shareBusinessProfile({
        businessName: "Barrio Boutique",
        publicPath: "/b/shop-111",
        navigatorRef,
      })
    ).resolves.toBe("copied");
  });
});
