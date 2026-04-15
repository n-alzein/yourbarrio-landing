import "server-only";

import { Resend } from "resend";

export type SendOrderEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  tags?: Array<{ name: string; value: string }>;
};

let cachedClient: Resend | null = null;

function getRequiredEnv(name: string) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing required Resend environment variable: ${name}`);
  }
  return value;
}

function getResendClient() {
  if (cachedClient) return cachedClient;
  cachedClient = new Resend(getRequiredEnv("RESEND_API_KEY"));
  return cachedClient;
}

export async function sendOrderNotificationEmail({
  to,
  subject,
  html,
  text,
  tags = [],
}: SendOrderEmailInput) {
  const resend = getResendClient();
  const result = await resend.emails.send({
    from: getRequiredEnv("RESEND_FROM_EMAIL"),
    to,
    subject,
    html,
    text,
    tags,
  });

  if (result.error) {
    throw new Error(result.error.message || "Failed to send order email");
  }

  return {
    provider: "resend" as const,
    providerMessageId: result.data?.id || null,
  };
}
