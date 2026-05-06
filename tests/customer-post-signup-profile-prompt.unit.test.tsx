import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CustomerPostSignupProfilePrompt, {
  markCustomerProfilePromptPending,
} from "@/components/customer/CustomerPostSignupProfilePrompt";

let mockAuth: any;

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => mockAuth,
}));

describe("CustomerPostSignupProfilePrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const storage = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
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
    mockAuth = {
      user: { id: "user-1", email: "customer@example.com" },
      profile: {
        id: "user-1",
        email: "customer@example.com",
        role: "customer",
        full_name: "",
        phone: "",
      },
      refreshProfile: vi.fn(),
    };
  });

  it("appears after new customer signup only when marked pending", () => {
    render(<CustomerPostSignupProfilePrompt />);
    expect(screen.queryByRole("heading", { name: "Welcome to YourBarrio" })).not.toBeInTheDocument();

    markCustomerProfilePromptPending("user-1");
    render(<CustomerPostSignupProfilePrompt />);

    expect(screen.getByRole("heading", { name: "Welcome to YourBarrio" })).toBeInTheDocument();
    expect(screen.getByText("Add your name so local shops know who they’re helping.")).toBeInTheDocument();
  });

  it("skipping prevents immediate repeated display", () => {
    markCustomerProfilePromptPending("user-1");
    const { unmount } = render(<CustomerPostSignupProfilePrompt />);

    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(screen.queryByRole("heading", { name: "Welcome to YourBarrio" })).not.toBeInTheDocument();

    unmount();
    render(<CustomerPostSignupProfilePrompt />);
    expect(screen.queryByRole("heading", { name: "Welcome to YourBarrio" })).not.toBeInTheDocument();
  });

  it("saves full name through the account profile API", async () => {
    markCustomerProfilePromptPending("user-1");
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        profile: {
          id: "user-1",
          full_name: "Nour Customer",
        },
      }),
    })) as any;

    render(<CustomerPostSignupProfilePrompt />);
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Nour Customer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/account/profile",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ full_name: "Nour Customer" }),
        })
      );
    });
    expect(mockAuth.refreshProfile).toHaveBeenCalled();
  });
});
