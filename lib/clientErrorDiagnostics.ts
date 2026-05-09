import { isChunkLoadError } from "@/lib/chunkErrorRecovery";

const CLIENT_ERROR_ENDPOINT = "/api/client-errors";
const MAX_TEXT_LENGTH = 500;
const MAX_STACK_LINES = 3;
const sentKeys = new Set<string>();

function truncate(value: unknown, max = MAX_TEXT_LENGTH): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value);
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function getErrorRecord(error: unknown): Record<string, unknown> {
  return error && typeof error === "object" ? (error as Record<string, unknown>) : {};
}

export function getStackLines(error: unknown): string[] {
  const record = getErrorRecord(error);
  const stack =
    typeof record.stack === "string"
      ? record.stack
      : error instanceof Error
        ? error.stack
        : null;
  return stack
    ? stack
        .split("\n")
        .slice(0, MAX_STACK_LINES)
        .map((line) => truncate(line, 240))
        .filter((line): line is string => Boolean(line))
    : [];
}

export function buildClientErrorDiagnostic({
  error,
  source,
  pathname,
  userAgent,
  extra = {},
}: {
  error: unknown;
  source: string;
  pathname?: string;
  userAgent?: string;
  extra?: Record<string, unknown>;
}) {
  const record = getErrorRecord(error);
  const name =
    truncate(record.name) ||
    (error instanceof Error ? truncate(error.name) : null) ||
    null;
  const message =
    truncate(record.message) ||
    (error instanceof Error ? truncate(error.message) : null) ||
    (typeof error === "string" ? truncate(error) : null) ||
    null;
  const digest = truncate(record.digest);
  return {
    source: truncate(source, 80) || "unknown",
    pathname: truncate(pathname, 300) || "",
    name,
    message,
    stack: getStackLines(error),
    digest,
    matchedChunkSignature: isChunkLoadError(error),
    userAgent: truncate(userAgent, 500) || "",
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

export function shouldSendGlobalClientErrorDiagnostics(): boolean {
  return process.env.NEXT_PUBLIC_CLIENT_ERROR_DIAGNOSTICS === "1";
}

export function sendClientErrorDiagnostic(payload: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    const key = JSON.stringify({
      source: payload.source,
      pathname: payload.pathname,
      name: payload.name,
      message: payload.message,
      digest: payload.digest,
      matchedChunkSignature: payload.matchedChunkSignature,
    });
    if (sentKeys.has(key)) return;
    sentKeys.add(key);
    if (sentKeys.size > 80) {
      const first = sentKeys.values().next().value;
      if (first) sentKeys.delete(first);
    }

    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      const sent = navigator.sendBeacon(
        CLIENT_ERROR_ENDPOINT,
        new Blob([body], { type: "application/json" })
      );
      if (sent) return;
    }
    fetch(CLIENT_ERROR_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore diagnostics failures */
  }
}

export function reportClientError({
  error,
  source,
  pathname,
  extra,
}: {
  error: unknown;
  source: string;
  pathname?: string;
  extra?: Record<string, unknown>;
}) {
  if (typeof window === "undefined") return;
  const diagnostic = buildClientErrorDiagnostic({
    error,
    source,
    pathname: pathname || window.location?.pathname || "",
    userAgent: window.navigator?.userAgent || "",
    extra,
  });
  sendClientErrorDiagnostic(diagnostic);
}
