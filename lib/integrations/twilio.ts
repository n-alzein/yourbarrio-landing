import "server-only";

import twilio from "twilio";

export type TwilioFailureKind = "transient" | "permanent";

export type ClassifiedTwilioError = {
  kind: TwilioFailureKind;
  code: string | null;
  message: string;
  statusCode: number | null;
};

export type SendTwilioSmsInput = {
  to: string;
  body: string;
  statusCallback?: string | null;
};

export type SendTwilioSmsResult = {
  provider: "twilio";
  providerMessageId: string;
  status: "pending" | "sent";
  rawStatus: string | null;
};

let cachedClient: ReturnType<typeof twilio> | null = null;

const TRANSIENT_TWILIO_CODES = new Set([
  20429,
  30001,
  30002,
  30003,
  30004,
  30005,
  30006,
  30008,
]);

const PERMANENT_TWILIO_CODES = new Set([
  21211,
  21214,
  21408,
  21606,
  21610,
  21612,
  21614,
  21617,
  21618,
]);

function getRequiredEnv(name: string) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing required Twilio environment variable: ${name}`);
  }
  return value;
}

export function getTwilioClient() {
  if (cachedClient) return cachedClient;
  cachedClient = twilio(
    getRequiredEnv("TWILIO_ACCOUNT_SID"),
    getRequiredEnv("TWILIO_AUTH_TOKEN")
  );
  return cachedClient;
}

export function normalizePhoneNumber(input: string | null | undefined) {
  const raw = String(input || "").trim();
  if (!raw) return null;

  if (/^\+[1-9]\d{7,14}$/.test(raw)) {
    return raw;
  }

  const digits = raw.replace(/\D+/g, "");
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return null;
}

export function classifyTwilioError(error: any): ClassifiedTwilioError {
  const codeNumber = Number(error?.code);
  const statusCode = Number(error?.status);
  const message = String(error?.message || "Unknown Twilio send failure");
  const code = Number.isFinite(codeNumber) ? String(codeNumber) : null;
  const normalizedMessage = message.toLowerCase();

  if (
    (Number.isFinite(statusCode) && (statusCode === 429 || statusCode >= 500)) ||
    (Number.isFinite(codeNumber) && TRANSIENT_TWILIO_CODES.has(codeNumber)) ||
    normalizedMessage.includes("timeout") ||
    normalizedMessage.includes("timed out") ||
    normalizedMessage.includes("temporar") ||
    normalizedMessage.includes("network") ||
    normalizedMessage.includes("socket") ||
    normalizedMessage.includes("rate limit")
  ) {
    return {
      kind: "transient",
      code,
      message,
      statusCode: Number.isFinite(statusCode) ? statusCode : null,
    };
  }

  if (
    (Number.isFinite(codeNumber) && PERMANENT_TWILIO_CODES.has(codeNumber)) ||
    normalizedMessage.includes("opt out") ||
    normalizedMessage.includes("unsubscribe") ||
    normalizedMessage.includes("invalid") ||
    normalizedMessage.includes("not a valid") ||
    normalizedMessage.includes("not currently reachable")
  ) {
    return {
      kind: "permanent",
      code,
      message,
      statusCode: Number.isFinite(statusCode) ? statusCode : null,
    };
  }

  return {
    kind: Number.isFinite(statusCode) && statusCode >= 500 ? "transient" : "permanent",
    code,
    message,
    statusCode: Number.isFinite(statusCode) ? statusCode : null,
  };
}

export function mapTwilioSendStatus(status: string | null | undefined) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "sent") return "sent";
  return "pending";
}

export async function sendTwilioSms({
  to,
  body,
  statusCallback,
}: SendTwilioSmsInput): Promise<SendTwilioSmsResult> {
  const client = getTwilioClient();
  const message = await client.messages.create({
    to,
    from: getRequiredEnv("TWILIO_FROM_NUMBER"),
    body,
    statusCallback: statusCallback || getRequiredEnv("TWILIO_STATUS_CALLBACK_URL"),
  });

  return {
    provider: "twilio",
    providerMessageId: message.sid,
    status: mapTwilioSendStatus(message.status || null),
    rawStatus: message.status || null,
  };
}

export function validateTwilioRequestSignature({
  urls,
  signature,
  params,
}: {
  urls: string[];
  signature: string;
  params: Record<string, string>;
}) {
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || "").trim();
  if (!authToken || !signature) {
    return false;
  }
  return urls.some((url) => twilio.validateRequest(authToken, signature, url, params));
}

function getForwardedHeaderValue(request: Request, name: string) {
  const value = String(request.headers.get(name) || "").trim();
  if (!value) return "";
  return value
    .split(",")
    .map((entry) => entry.trim())
    .find(Boolean) || "";
}

export function buildTwilioWebhookValidationUrl(request: Request) {
  const url = new URL(request.url);
  const forwardedProto = getForwardedHeaderValue(request, "x-forwarded-proto");
  const forwardedHost = getForwardedHeaderValue(request, "x-forwarded-host");
  const host = forwardedHost || String(request.headers.get("host") || "").trim() || url.host;
  const protocol = forwardedProto || url.protocol.replace(":", "");

  if (!host || !protocol) {
    return url.toString();
  }

  return `${protocol}://${host}${url.pathname}${url.search}`;
}

export function buildTwilioSignatureUrls(request: Request) {
  const url = new URL(request.url);
  const reconstructed = buildTwilioWebhookValidationUrl(request);
  const configured = String(process.env.TWILIO_STATUS_CALLBACK_URL || "").trim();

  return Array.from(new Set([configured, reconstructed, url.toString()].filter(Boolean)));
}
