import "server-only";

import { resend } from "@/lib/email/resendClient";

type SendResetPasswordEmailInput = {
  to: string;
  resetUrl: string;
  productName?: string;
  supportEmail?: string;
  subject?: string;
};

export async function sendResetPasswordEmail({
  to,
  resetUrl,
  productName = "YourBarrio",
  supportEmail = process.env.SUPPORT_EMAIL || "support@yourbarrio.com",
  subject,
}: SendResetPasswordEmailInput) {
  const templateId = process.env.RESEND_RESET_PASSWORD_TEMPLATE_ID || "reset-your-password";
  const from =
    process.env.RESEND_FROM_EMAIL ||
    process.env.RESEND_FROM ||
    "YourBarrio <no-reply@yourbarrio.com>";
  const finalSubject = subject || `Reset your ${productName} password`;
  if (process.env.NODE_ENV !== "production" && resetUrl.includes("&amp;")) {
    console.warn("[email.reset-password] resetUrl appears HTML-escaped before send");
  }

  const maskEmail = (input: string) => {
    const [localPart, domain = ""] = String(input || "").split("@");
    if (!localPart) return "***";
    return `${localPart.slice(0, 2)}***@${domain}`;
  };

  if (process.env.NODE_ENV !== "production") {
    console.info("[email.reset-password] attempting_resend_template_send", {
      to: maskEmail(to),
      templateId,
      hasResetUrl: Boolean(resetUrl),
      variableNames: ["resetUrl", "supportEmail", "productName"],
    });
  }

  const result = await resend.emails.send({
    from,
    to,
    subject: finalSubject,
    template: {
      id: templateId,
      variables: {
        resetUrl,
        supportEmail,
        productName,
      },
    },
  });

  if (result.error) {
    console.error("[email.reset-password] template send failed", {
      to: maskEmail(to),
      templateId,
      reason: result.error.message || "unknown_error",
    });
    throw new Error(result.error.message || "Failed to send reset password email");
  }

  return result;
}
