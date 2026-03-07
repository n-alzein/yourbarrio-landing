import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateLinkMock, inviteUserByEmailMock, signInWithOtpMock, resendSendMock } = vi.hoisted(
  () => ({
    generateLinkMock: vi.fn(),
    inviteUserByEmailMock: vi.fn(),
    signInWithOtpMock: vi.fn(),
    resendSendMock: vi.fn(),
  })
);

vi.mock("@/lib/auth/supabaseAdmin", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        generateLink: generateLinkMock,
        inviteUserByEmail: inviteUserByEmailMock,
      },
      signInWithOtp: signInWithOtpMock,
    },
  },
}));

vi.mock("@/lib/email/resendClient", () => ({
  resend: {
    emails: {
      send: resendSendMock,
    },
  },
}));
vi.mock("server-only", () => ({}));

import { sendAdminInvite } from "@/lib/email/adminInvite";

describe("sendAdminInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses generateLink magiclink + Resend template and does not call Supabase email send methods", async () => {
    generateLinkMock.mockResolvedValue({
      data: {
        properties: {
          action_link: "https://yourbarrio.com/irrelevant",
          hashed_token: "hashed_abc",
          verification_type: "email",
        },
        user: {
          id: "11111111-1111-4111-8111-111111111111",
        },
      },
      error: null,
    });
    resendSendMock.mockResolvedValue({ data: { id: "msg_123" }, error: null });

    const result = await sendAdminInvite("biz@example.com", "https://yourbarrio.com");

    expect(generateLinkMock).toHaveBeenCalledWith({
      type: "magiclink",
      email: "biz@example.com",
      options: {
        redirectTo: "https://yourbarrio.com/auth/confirm?next=/business/onboarding",
      },
    });
    expect(resendSendMock).toHaveBeenCalledWith({
      from: "YourBarrio <no-reply@yourbarrio.com>",
      to: "biz@example.com",
      subject: "YourBarrio — Set up your business account",
      template: {
        id: "business-account-invitation",
        variables: {
          magicLink:
            "https://yourbarrio.com/auth/confirm?next=%2Fbusiness%2Fonboarding&token_hash=hashed_abc&type=email",
          supportEmail: "support@yourbarrio.com",
        },
      },
      tags: [{ name: "email_kind", value: "business_invite" }],
    });
    expect(inviteUserByEmailMock).not.toHaveBeenCalled();
    expect(signInWithOtpMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      userId: "11111111-1111-4111-8111-111111111111",
      inviteLink:
        "https://yourbarrio.com/auth/confirm?next=%2Fbusiness%2Fonboarding&token_hash=hashed_abc&type=email",
    });
  });

  it("throws when Resend returns an error so invite flow cannot silently succeed", async () => {
    generateLinkMock.mockResolvedValue({
      data: {
        properties: {
          action_link: "https://yourbarrio.com/irrelevant",
          hashed_token: "hashed_abc",
          verification_type: "email",
        },
        user: {
          id: "11111111-1111-4111-8111-111111111111",
        },
      },
      error: null,
    });
    resendSendMock.mockResolvedValue({
      data: null,
      error: { message: "resend_failed" },
    });

    await expect(sendAdminInvite("biz@example.com", "https://yourbarrio.com")).rejects.toThrow(
      "resend_failed"
    );
  });
});
