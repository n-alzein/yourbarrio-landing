import { NextResponse } from "next/server";

const MAX_TEXT_LENGTH = 500;
const MAX_STACK_LINES = 3;
const ALLOWED_SOURCES = new Set([
  "app-error",
  "global-error",
  "chunk-recovery",
  "chunk-boundary",
  "window-error",
  "unhandledrejection",
]);

export const dynamic = "force-dynamic";

function cleanText(value: unknown, max = MAX_TEXT_LENGTH): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max)}...` : trimmed;
}

function cleanStack(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_STACK_LINES)
    .map((line) => cleanText(line, 240))
    .filter((line): line is string => Boolean(line));
}

function cleanBoolean(value: unknown): boolean {
  return value === true;
}

function sanitizePayload(value: unknown) {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const source = cleanText(record.source, 80) || "unknown";
  return {
    source: ALLOWED_SOURCES.has(source) ? source : "unknown",
    pathname: cleanText(record.pathname, 300) || "",
    name: cleanText(record.name) || null,
    message: cleanText(record.message) || null,
    stack: cleanStack(record.stack),
    digest: cleanText(record.digest, 120) || null,
    matchedChunkSignature: cleanBoolean(record.matchedChunkSignature),
    userAgent: cleanText(record.userAgent, 500) || "",
    timestamp: cleanText(record.timestamp, 80) || new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const sanitized = sanitizePayload(payload);
  console.warn("[CLIENT_ERROR_DIAGNOSTIC]", sanitized);
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
