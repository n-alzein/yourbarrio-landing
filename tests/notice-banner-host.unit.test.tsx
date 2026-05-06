import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NoticeBannerHost from "@/components/common/NoticeBannerHost";

let mockAuth: any;
let mockPathname = "/nearby";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => mockAuth,
}));

function mockSessionStorage() {
  const storage = new Map<string, string>();
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    value: {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key);
      }),
    },
  });
  return storage;
}

describe("NoticeBannerHost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/nearby";
    mockSessionStorage();
    mockAuth = {
      authStatus: "authenticated",
      user: { id: "user-1", email: "customer@example.com" },
      role: "customer",
      profile: {
        id: "user-1",
        role: "customer",
        full_name: "",
        phone: "",
      },
    };
  });

  it("renders profile completion notice with settings CTA", () => {
    render(<NoticeBannerHost audience="customer" />);

    expect(screen.getByText("Finish setting up your account")).toBeInTheDocument();
    expect(
      screen.getByText("Add your name, phone, and address for faster checkout and pickup coordination.")
    ).toBeInTheDocument();
    expect(screen.getByText("Finish your account")).toBeInTheDocument();
    expect(screen.getByText("Add missing details for faster checkout.")).toBeInTheDocument();
    expect(screen.getAllByText("Add details")[0]).toHaveAttribute(
      "href",
      "/customer/settings?complete=profile"
    );
    const notice = screen
      .getByText("Finish setting up your account")
      .closest("[data-notice-id]");
    expect(notice).toHaveAttribute("data-sticky", "false");
    expect(notice?.className).not.toContain("sticky");
  });

  it("dismissing a notice hides it and writes the sessionStorage key", () => {
    render(<NoticeBannerHost audience="customer" />);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss notice" }));

    expect(screen.queryByText("Finish setting up your account")).not.toBeInTheDocument();
    expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
      "yb_notice_dismissed:customer-profile-completion:user-1",
      "1"
    );
  });

  it("does not render a dismissed notice again in the same session", async () => {
    window.sessionStorage.setItem(
      "yb_notice_dismissed:customer-profile-completion:user-1",
      "1"
    );

    render(<NoticeBannerHost audience="customer" />);

    await waitFor(() => {
      expect(screen.queryByText("Finish setting up your account")).not.toBeInTheDocument();
    });
  });
});
