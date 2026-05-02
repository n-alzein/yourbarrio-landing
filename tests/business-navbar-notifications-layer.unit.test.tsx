import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BusinessNavbar from "@/components/navbars/BusinessNavbar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/business/orders",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt, priority, fill, ...props }) => <img alt={alt} {...props} />,
}));

vi.mock("@/components/AuthProvider", () => ({
  AUTH_UI_RESET_EVENT: "yb-auth-ui-reset",
  useAuth: () => ({
    user: { id: "business-user-1", email: "owner@example.com", user_metadata: {} },
    profile: { email: "owner@example.com", business_name: "Fashion Corner" },
    business: { business_name: "Fashion Corner" },
    role: "business",
    loadingUser: false,
    supabase: null,
    authStatus: "authenticated",
    authBusy: false,
    authAction: null,
    authAttemptId: null,
    lastAuthEvent: null,
    providerInstanceId: "test-provider",
  }),
}));

vi.mock("@/components/LogoutButton", () => ({
  __esModule: true,
  default: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

vi.mock("@/components/nav/MobileSidebarDrawer", () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
}));

vi.mock("@/components/nav/AccountSidebar", () => ({
  __esModule: true,
  default: ({ children, open }) => (open ? <div>{children}</div> : null),
}));

vi.mock("@/components/nav/BusinessAccountMenuItems", () => ({
  __esModule: true,
  default: () => <div>Business account menu</div>,
}));

vi.mock("@/components/SafeAvatar", () => ({
  __esModule: true,
  default: ({ alt = "Avatar", className }) => <img alt={alt} className={className} />,
}));

vi.mock("@/lib/realtime/useRealtimeChannel", () => ({
  useRealtimeChannel: vi.fn(),
}));

vi.mock("@/lib/messages", () => ({
  fetchUnreadTotal: vi.fn(async () => 0),
}));

describe("BusinessNavbar notifications layering", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: true,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("renders the notifications dropdown above the navbar divider while anchored to the bell", () => {
    render(<BusinessNavbar />);

    fireEvent.click(screen.getByRole("button", { name: "Open notifications" }));

    const dropdown = screen.getByTestId("business-notifications-dropdown");
    expect(dropdown).toHaveClass("absolute", "right-0", "z-[60]");
    expect(dropdown.parentElement).toHaveClass("relative");
    expect(screen.getByText("Notifications")).toBeInTheDocument();
  });
});
