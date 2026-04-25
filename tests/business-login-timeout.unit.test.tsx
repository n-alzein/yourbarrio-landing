import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BusinessLoginClient from "@/components/business-auth/BusinessLoginClient";

const withTimeoutMock = vi.fn();
const signInWithPasswordMock = vi.fn(async () => ({
  data: {
    user: { id: "business-1" },
    session: {
      user: { id: "business-1" },
      access_token: "access-token",
      refresh_token: "refresh-token",
    },
  },
  error: null,
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/supabase/browser", () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      signInWithPassword: signInWithPasswordMock,
      signInWithOAuth: vi.fn(),
    },
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { role: "business", account_status: null },
            error: null,
          }),
        }),
      }),
    })),
  }),
}));

vi.mock("@/lib/withTimeout", () => ({
  withTimeout: (...args) => withTimeoutMock(...args),
}));

vi.mock("@/lib/fetchWithTimeout", () => ({
  fetchWithTimeout: vi.fn(),
}));

vi.mock("@/lib/supabase/cookieName", () => ({
  getSupabaseAuthCookieName: () => "sb-test-auth-token",
}));

vi.mock("@/lib/auth/logout", () => ({
  signOutLocalSession: vi.fn(),
}));

vi.mock("@/lib/auth/redirects", () => ({
  getPostLoginRedirect: () => "/business/dashboard",
}));

vi.mock("@/lib/auth/authIntent", () => ({
  clearAuthIntent: vi.fn(),
  consumeAuthIntent: vi.fn(() => null),
}));

vi.mock("@/lib/accountDeletion/status", () => ({
  isBlockedAccountStatus: () => false,
  normalizeAccountStatus: (value) => value,
}));

vi.mock("@/lib/auth/loginErrors", () => ({
  createBlockedLoginError: () => new Error("blocked"),
  GENERIC_INVALID_CREDENTIALS_MESSAGE: "Invalid email or password",
  isGenericInvalidCredentialsError: () => false,
  suppressAuthUiResetForCredentialsError: vi.fn(),
}));

vi.mock("@/lib/auth/clientRedirectState", () => ({
  getRequestedPathFromCurrentUrl: () => null,
  readClientRedirectState: () => null,
}));

vi.mock("@/lib/auth/oauthRedirect", () => ({
  buildOAuthCallbackUrl: () => "http://localhost/auth/callback",
  logOAuthStart: vi.fn(),
}));

describe("BusinessLoginClient timeout handling", () => {
  beforeEach(() => {
    withTimeoutMock.mockReset();
    signInWithPasswordMock.mockClear();
    withTimeoutMock
      .mockImplementationOnce(async (promise) => promise)
      .mockImplementationOnce(async () => {
        const error = new Error("Profile request timed out after 15s");
        error.name = "TimeoutError";
        throw error;
      });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("shows a friendly timeout message without logging a console error", async () => {
    render(<BusinessLoginClient />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "biz@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(
        screen.getByText("Login request timed out. Please check your connection and try again.")
      ).toBeInTheDocument();
    });

    expect(console.error).not.toHaveBeenCalledWith(
      "Business login failed",
      expect.any(Error)
    );
  });
});
