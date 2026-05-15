import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CustomerSignupModal from "@/components/modals/CustomerSignupModal";

const openModalMock = vi.fn();
const onCloseMock = vi.fn();
const locationReplaceMock = vi.fn();

let mockSupabase: any;

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    supabase: mockSupabase,
  }),
}));

vi.mock("@/components/modals/ModalProvider", () => ({
  useModal: () => ({
    openModal: openModalMock,
  }),
}));

vi.mock("@/lib/auth/oauthRedirect", () => ({
  buildOAuthCallbackUrl: () => "http://localhost/api/auth/callback",
  logOAuthStart: vi.fn(),
}));

function createSession(email = "new@example.com") {
  return {
    access_token: "access-token",
    refresh_token: "refresh-token",
    user: {
      id: "11111111-1111-4111-8111-111111111111",
      email,
    },
  };
}

function createSupabase({
  signUpResult,
  session = createSession(),
}: {
  signUpResult: any;
  session?: any;
}) {
  return {
    auth: {
      signUp: vi.fn(async () => signUpResult),
      getSession: vi.fn(async () => ({
        data: { session },
        error: null,
      })),
      signInWithOAuth: vi.fn(),
    },
    from: vi.fn(() => {
      throw new Error("Customer signup must not write public.users from the browser");
    }),
  };
}

function mockFetchWithProfile(email = "new@example.com") {
  return vi.fn(async (url: string) => {
    if (url === "/api/auth/refresh") {
      return {
        ok: true,
        headers: {
          get: (name: string) => (name === "x-auth-refresh-user" ? "1" : null),
        },
        json: async () => ({}),
      };
    }

    if (url === "/api/me") {
      return {
        ok: true,
        headers: {
          get: () => null,
        },
        json: async () => ({
          user: {
            id: "11111111-1111-4111-8111-111111111111",
            email,
          },
          profile: {
            id: "11111111-1111-4111-8111-111111111111",
            email,
            role: "customer",
          },
        }),
      };
    }

    if (url === "/api/account/legal-acceptances") {
      return {
        ok: true,
        headers: {
          get: () => null,
        },
        json: async () => ({ ok: true }),
      };
    }

    throw new Error(`Unexpected fetch ${url}`);
  }) as any;
}

function fillSignupForm(email = "new@example.com") {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "password123" },
  });
}

function acceptCustomerPolicies() {
  fireEvent.click(
    screen.getByLabelText(
      "I agree to the YourBarrio Terms of Service and acknowledge the Privacy Policy."
    )
  );
}

describe("CustomerSignupModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onCloseMock.mockReset();
    openModalMock.mockReset();
    locationReplaceMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...window.location,
        replace: locationReplaceMock,
      },
    });
  });

  it("completes first-time customer signup through auth and server profile provisioning", async () => {
    const session = createSession("new@example.com");
    mockSupabase = createSupabase({
      session,
      signUpResult: {
        data: {
          user: session.user,
          session,
        },
        error: null,
      },
    });
    global.fetch = mockFetchWithProfile("new@example.com");

    render(<CustomerSignupModal onClose={onCloseMock} />);
    fillSignupForm("new@example.com");
    acceptCustomerPolicies();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(locationReplaceMock).toHaveBeenCalledWith("/customer/home");
    });

    expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "password123",
      options: {
        data: {
          role: "customer",
        },
      },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/me",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
      })
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/account/legal-acceptances",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          customer_terms_accepted: true,
          source: "signup",
        }),
      })
    );
    expect(mockSupabase.from).not.toHaveBeenCalled();
    expect(onCloseMock).toHaveBeenCalled();
  });

  it("guards duplicate submits so only one signup request is sent", async () => {
    let resolveSignup: (value: any) => void;
    const signupPromise = new Promise((resolve) => {
      resolveSignup = resolve;
    });
    const session = createSession("new@example.com");
    mockSupabase = {
      auth: {
        signUp: vi.fn(() => signupPromise),
        getSession: vi.fn(async () => ({ data: { session }, error: null })),
        signInWithOAuth: vi.fn(),
      },
      from: vi.fn(),
    };
    global.fetch = mockFetchWithProfile("new@example.com");

    render(<CustomerSignupModal onClose={onCloseMock} />);
    fillSignupForm("new@example.com");
    acceptCustomerPolicies();
    const button = screen.getByRole("button", { name: "Create account" });

    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.submit(button.closest("form")!);

    expect(mockSupabase.auth.signUp).toHaveBeenCalledTimes(1);

    resolveSignup!({
      data: {
        user: session.user,
        session,
      },
      error: null,
    });

    await waitFor(() => {
      expect(locationReplaceMock).toHaveBeenCalledWith("/customer/home");
    });
  });

  it("keeps the intended next destination after signup", async () => {
    const session = createSession("new@example.com");
    mockSupabase = createSupabase({
      session,
      signUpResult: {
        data: {
          user: session.user,
          session,
        },
        error: null,
      },
    });
    global.fetch = mockFetchWithProfile("new@example.com");

    render(<CustomerSignupModal onClose={onCloseMock} next="/checkout?business_id=vendor-1" />);
    fillSignupForm("new@example.com");
    acceptCustomerPolicies();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(locationReplaceMock).toHaveBeenCalledWith("/checkout?business_id=vendor-1");
    });
  });

  it("repairs a missing public.users row when already-registered auth has a current session", async () => {
    const session = createSession("repaired@example.com");
    mockSupabase = createSupabase({
      session,
      signUpResult: {
        data: { user: null, session: null },
        error: { message: "User already registered" },
      },
    });
    global.fetch = mockFetchWithProfile("repaired@example.com");

    render(<CustomerSignupModal onClose={onCloseMock} />);
    fillSignupForm("repaired@example.com");
    acceptCustomerPolicies();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(locationReplaceMock).toHaveBeenCalledWith("/customer/home");
    });

    expect(mockSupabase.auth.getSession).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/me",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-yb-auth-bootstrap": "customer_signup",
        }),
      })
    );
    expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
  });

  it("shows a friendly login message for an existing completed account with no repair session", async () => {
    mockSupabase = createSupabase({
      session: null,
      signUpResult: {
        data: { user: null, session: null },
        error: { message: "User already registered" },
      },
    });
    global.fetch = vi.fn() as any;

    render(<CustomerSignupModal onClose={onCloseMock} />);
    fillSignupForm("existing@example.com");
    acceptCustomerPolicies();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByText("An account with this email already exists. Log in instead.")
    ).toBeInTheDocument();
    expect(locationReplaceMock).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("renders customer Terms and Privacy consent links without Business Terms", () => {
    mockSupabase = createSupabase({
      signUpResult: {
        data: { user: null, session: null },
        error: null,
      },
    });

    render(<CustomerSignupModal onClose={onCloseMock} />);

    expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute(
      "href",
      "/terms"
    );
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy"
    );
    expect(screen.queryByText(/Business Terms/i)).not.toBeInTheDocument();
  });

  it("shows consent validation only after submit attempt and blocks signup when unchecked", async () => {
    mockSupabase = createSupabase({
      signUpResult: {
        data: { user: null, session: null },
        error: null,
      },
    });
    global.fetch = vi.fn() as any;

    render(<CustomerSignupModal onClose={onCloseMock} />);
    fillSignupForm("new@example.com");

    expect(
      screen.queryByText(
        "Please accept the Terms of Service and Privacy Policy to continue."
      )
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByText(
        "Please accept the Terms of Service and Privacy Policy to continue."
      )
    ).toBeInTheDocument();
    expect(mockSupabase.auth.signUp).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
