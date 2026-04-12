import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileHero } from "@/components/business/profile-system/ProfileSystem";

let mockAuth = {
  user: null,
  role: null,
  supabase: null,
};

const pushMock = vi.fn();
const getOrCreateConversationMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
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
    pushMock.mockReset();
    getOrCreateConversationMock.mockReset();
    mockAuth = {
      user: null,
      role: null,
      supabase: null,
    };
  });

  it("shows directions as the primary CTA and keeps guest messaging de-emphasized", () => {
    render(
      <ProfileHero
        mode="preview"
        profile={profile}
        ratingSummary={{ count: 3, average: 4.7 }}
        publicPath="/b/shop-111"
      />
    );

    expect(screen.getByRole("link", { name: "Directions" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Website" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Call" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in to message" })).toHaveAttribute(
      "href",
      "/login?next=%2Fmessages%2F00000000-0000-0000-0000-000000000111"
    );
    expect(screen.queryByText("Local business")).not.toBeInTheDocument();
    expect(screen.getAllByText("Los Angeles, CA")).toHaveLength(1);
    expect(screen.getByLabelText("Share")).toBeInTheDocument();
  });

  it("keeps message subtle for logged-in customers and opens the conversation", async () => {
    mockAuth = {
      user: { id: "00000000-0000-0000-0000-000000000222" },
      role: "customer",
      supabase: { rpc: vi.fn() },
    };
    getOrCreateConversationMock.mockResolvedValue("conversation-123");

    render(
      <ProfileHero
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
});
