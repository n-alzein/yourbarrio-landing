import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BusinessReviewsPanel from "@/components/publicBusinessProfile/BusinessReviewsPanel";

const openModalMock = vi.fn();
const setAuthIntentMock = vi.fn();
const fetchMock = vi.fn(async () => ({
  ok: false,
  json: async () => ({ reviews: [] }),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ supabase: null }),
}));

vi.mock("@/components/modals/ModalProvider", () => ({
  useModal: () => ({ openModal: openModalMock }),
}));

vi.mock("@/lib/auth/authIntent", () => ({
  setAuthIntent: (...args) => setAuthIntentMock(...args),
}));

vi.mock("@/components/public/ViewerContextEnhancer", () => ({
  useViewerContext: () => ({
    status: "guest",
    role: null,
    user: null,
    profile: null,
    loading: false,
    isAuthenticated: false,
    isCustomer: false,
    isBusiness: false,
    isAdmin: false,
    isInternal: false,
  }),
}));

vi.mock("@/components/moderation/ReportModal", () => ({
  __esModule: true,
  default: () => null,
}));

describe("BusinessReviewsPanel auth gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState({}, "", "/b/test-shop?ref=reviews");
  });

  it("prompts guests to sign in instead of showing a writable review form", () => {
    render(
      <BusinessReviewsPanel
        businessId="00000000-0000-0000-0000-000000000001"
        initialReviews={[]}
        ratingSummary={{ count: 0, average: 0, breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }}
        reviewCount={0}
      />
    );

    expect(screen.getByText("Sign in to write a review")).toBeInTheDocument();
    expect(screen.queryByText("Leave a review")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(setAuthIntentMock).toHaveBeenCalledWith({
      redirectTo: "/b/test-shop?ref=reviews",
      role: "customer",
    });
    expect(openModalMock).toHaveBeenCalledWith("customer-login", {
      next: "/b/test-shop?ref=reviews",
    });
  });

  it("renders review dates with a deterministic SSR-safe format", () => {
    render(
      <BusinessReviewsPanel
        businessId="00000000-0000-0000-0000-000000000001"
        initialReviews={[
          {
            id: "review-1",
            business_id: "00000000-0000-0000-0000-000000000001",
            customer_id: "cust-1",
            rating: 5,
            title: "Great spot",
            body: "Loved it.",
            created_at: "2026-04-07T00:00:00.000Z",
            updated_at: null,
            business_reply: null,
            business_reply_at: null,
            author_profile: {
              user_id: "cust-1",
              display_name: "Reviewer One",
              avatar_url: null,
            },
          },
        ]}
        ratingSummary={{ count: 1, average: 5, breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 } }}
        reviewCount={1}
      />
    );

    expect(screen.getByText("Apr 7, 2026")).toBeInTheDocument();
  });
});
