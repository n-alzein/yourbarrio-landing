import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

const { resendSendMock } = vi.hoisted(() => ({
  resendSendMock: vi.fn(),
}));

vi.mock("@/lib/email/resendClient", () => ({
  resend: {
    emails: {
      send: resendSendMock,
    },
  },
}));
vi.mock("server-only", () => ({}));

import { sendResetPasswordEmail } from "@/lib/email/sendResetPasswordEmail";

describe("password reset email delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("sends the published Resend reset template without inline content", async () => {
    resendSendMock.mockResolvedValue({ data: { id: "msg_reset" }, error: null });

    await sendResetPasswordEmail({
      to: "customer@example.com",
      resetUrl: "https://www.yourbarrio.com/set-password?token_hash=abc&type=recovery",
      productName: "YourBarrio",
      supportEmail: "support@yourbarrio.com",
    });

    expect(resendSendMock).toHaveBeenCalledWith({
      from: "YourBarrio <no-reply@yourbarrio.com>",
      to: "customer@example.com",
      subject: "Reset your YourBarrio password",
      template: {
        id: "reset-your-password",
        variables: {
          resetUrl: "https://www.yourbarrio.com/set-password?token_hash=abc&type=recovery",
          supportEmail: "support@yourbarrio.com",
          productName: "YourBarrio",
        },
      },
    });
    expect(resendSendMock.mock.calls[0][0]).not.toHaveProperty("html");
    expect(resendSendMock.mock.calls[0][0]).not.toHaveProperty("text");
    expect(resendSendMock.mock.calls[0][0]).not.toHaveProperty("react");
  });

  it("uses the dedicated template id and sender env vars when configured", async () => {
    vi.stubEnv("RESEND_RESET_PASSWORD_TEMPLATE_ID", "tpl_reset_uuid");
    vi.stubEnv("RESEND_FROM_EMAIL", "YourBarrio <no-reply@yourbarrio.com>");
    vi.stubEnv("SUPPORT_EMAIL", "help@yourbarrio.com");
    resendSendMock.mockResolvedValue({ data: { id: "msg_reset" }, error: null });

    await sendResetPasswordEmail({
      to: "customer@example.com",
      resetUrl: "https://www.yourbarrio.com/set-password?token_hash=abc&type=recovery",
    });

    expect(resendSendMock.mock.calls[0][0].template).toEqual({
      id: "tpl_reset_uuid",
      variables: {
        resetUrl: "https://www.yourbarrio.com/set-password?token_hash=abc&type=recovery",
        supportEmail: "help@yourbarrio.com",
        productName: "YourBarrio",
      },
    });
  });

  it("does not fall back to inline reset email content", async () => {
    resendSendMock.mockResolvedValue({
      data: null,
      error: { message: "template variable missing" },
    });

    await expect(
      sendResetPasswordEmail({
        to: "customer@example.com",
        resetUrl: "https://www.yourbarrio.com/set-password?token_hash=abc&type=recovery",
      })
    ).rejects.toThrow("template variable missing");

    expect(resendSendMock).toHaveBeenCalledTimes(1);
    expect(resendSendMock.mock.calls[0][0]).not.toHaveProperty("html");
    expect(resendSendMock.mock.calls[0][0]).not.toHaveProperty("text");
  });

  it("keeps password reset requests off Supabase's built-in email sender", () => {
    const forgotPage = fs.readFileSync(
      path.join(process.cwd(), "app/(auth)/auth/forgot-password/page.js"),
      "utf8"
    );
    const settingsDialog = fs.readFileSync(
      path.join(process.cwd(), "components/settings/ManagePasswordDialog.jsx"),
      "utf8"
    );
    const resetRoute = fs.readFileSync(
      path.join(process.cwd(), "app/api/auth/request-password-reset/route.ts"),
      "utf8"
    );

    expect(forgotPage).toContain('fetch("/api/auth/request-password-reset"');
    expect(settingsDialog).toContain('fetch("/api/auth/request-password-reset"');
    expect(resetRoute).toContain("auth.admin.generateLink");
    expect(`${forgotPage}\n${settingsDialog}\n${resetRoute}`).not.toContain(
      "resetPasswordForEmail"
    );
  });
});
