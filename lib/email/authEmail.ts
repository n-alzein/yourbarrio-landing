import "server-only";

import { resend } from "@/lib/email/resendClient";

export const DEFAULT_AUTH_EMAIL_FROM = "YourBarrio <auth@yourbarrio.com>";

export function getAuthEmailFrom() {
  return String(process.env.AUTH_EMAIL_FROM || DEFAULT_AUTH_EMAIL_FROM).trim();
}

export function getAuthEmailSiteUrl(siteUrl: string) {
  try {
    const url = new URL(siteUrl);
    if (
      process.env.NODE_ENV === "production" &&
      (url.hostname === "yourbarrio.com" || url.hostname === "www.yourbarrio.com")
    ) {
      return "https://www.yourbarrio.com";
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return siteUrl;
  }
}

type SendAuthTemplateEmailInput = {
  to: string;
  subject: string;
  templateId: string;
  variables: Record<string, string | number>;
  tags?: Array<{ name: string; value: string }>;
};

type SendAuthManualEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  tags?: Array<{ name: string; value: string }>;
};

function logAuthEmailError({
  error,
  context,
}: {
  error: unknown;
  context: Record<string, unknown>;
}) {
  const resendError = error as {
    message?: string;
    name?: string;
    statusCode?: number;
    status?: number;
  } | null;

  console.error("[email.auth] resend_send_failed", {
    ...context,
    errorName: resendError?.name || null,
    statusCode: resendError?.statusCode || resendError?.status || null,
    message: resendError?.message || "unknown_error",
  });
}

export async function sendAuthTemplateEmail({
  to,
  subject,
  templateId,
  variables,
  tags,
}: SendAuthTemplateEmailInput) {
  const result = await resend.emails.send({
    from: getAuthEmailFrom(),
    to,
    subject,
    template: {
      id: templateId,
      variables,
    },
    tags,
  });

  if (result.error) {
    logAuthEmailError({
      error: result.error,
      context: {
        emailKind: "auth_template",
        templateId,
        hasTemplate: true,
        hasText: false,
      },
    });
  }

  return result;
}

export async function sendAuthManualEmail({
  to,
  subject,
  html,
  text,
  tags,
}: SendAuthManualEmailInput) {
  const result = await resend.emails.send({
    from: getAuthEmailFrom(),
    to,
    subject,
    html,
    text,
    tags,
  });

  if (result.error) {
    logAuthEmailError({
      error: result.error,
      context: {
        emailKind: "auth_manual",
        hasTemplate: false,
        hasText: Boolean(text),
      },
    });
  }

  return result;
}

export function buildPasswordResetText({
  resetUrl,
  productName = "YourBarrio",
  supportEmail,
}: {
  resetUrl: string;
  productName?: string;
  supportEmail: string;
}) {
  return [
    `Reset your ${productName} password`,
    "",
    `Use this secure link to set a new password for your ${productName} account:`,
    resetUrl,
    "",
    "If you did not request this password reset, you can ignore this email.",
    `Need help? Contact ${supportEmail}.`,
  ].join("\n");
}

export function buildBusinessMagicLinkText({
  magicLink,
  supportEmail,
}: {
  magicLink: string;
  supportEmail: string;
}) {
  return [
    "Set up your YourBarrio business account",
    "",
    "Use this secure link to continue signing in to YourBarrio:",
    magicLink,
    "",
    "If you did not request this email, you can ignore it.",
    `Need help? Contact ${supportEmail}.`,
  ].join("\n");
}
