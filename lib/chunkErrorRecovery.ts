export const CHUNK_RECOVERY_GUARD_KEY = "yb_chunk_recovered";

const CHUNK_ERROR_PATTERNS = [
  /ChunkLoadError/i,
  /Loading chunk [\w-]+ failed/i,
  /Loading CSS chunk [\w-]+ failed/i,
  /CSS chunk load failed/i,
  /Failed to fetch dynamically imported module/i,
  /Error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i,
  /\/_next\/static\/(?:chunks|css)\//i,
];

const NEXT_STATIC_ASSET_PATTERN = /\/_next\/static\/(?:chunks|css)\//i;
const NON_APP_ASSET_PATTERN =
  /\/(?:api|business-photos|business-gallery|listing-photos|profile-photos|avatars)\//i;
const HTTP_API_ERROR_PATTERNS = [
  /\b(?:401|403|404)\b/,
  /\bUnauthorized\b/i,
  /\bForbidden\b/i,
  /\bNot Found\b/i,
  /\/api\//i,
];

function collectErrorText(value: unknown, seen = new Set<unknown>()): string {
  if (!value || seen.has(value)) return "";
  seen.add(value);

  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (value instanceof Error) {
    return [value.name, value.message, value.stack].filter(Boolean).join("\n");
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return [
      record.name,
      record.message,
      record.stack,
      record.reason ? collectErrorText(record.reason, seen) : "",
      record.error ? collectErrorText(record.error, seen) : "",
      record.cause ? collectErrorText(record.cause, seen) : "",
      record.target ? collectErrorText(record.target, seen) : "",
      record.srcElement ? collectErrorText(record.srcElement, seen) : "",
      typeof record.href === "string" ? record.href : "",
      typeof record.src === "string" ? record.src : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function collectErrorStatus(value: unknown, seen = new Set<unknown>()): number | null {
  if (!value || seen.has(value)) return null;
  seen.add(value);

  if (typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const status = record.status ?? record.statusCode;
  if (typeof status === "number") return status;
  if (typeof status === "string") {
    const parsed = Number.parseInt(status, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return (
    collectErrorStatus(record.reason, seen) ??
    collectErrorStatus(record.error, seen) ??
    collectErrorStatus(record.cause, seen) ??
    collectErrorStatus(record.target, seen) ??
    collectErrorStatus(record.srcElement, seen)
  );
}

function isHttpApiErrorText(text: string): boolean {
  return HTTP_API_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}

export function isChunkLoadError(error: unknown): boolean {
  const text = collectErrorText(error);
  if (!text) return false;
  const hasNextStaticAsset = NEXT_STATIC_ASSET_PATTERN.test(text);
  const status = collectErrorStatus(error);
  if (!hasNextStaticAsset && status && status >= 400 && status < 500) {
    return false;
  }
  if (!hasNextStaticAsset && NON_APP_ASSET_PATTERN.test(text)) {
    return false;
  }
  if (!hasNextStaticAsset && isHttpApiErrorText(text)) {
    return false;
  }
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}

export function getChunkErrorDiagnostics(
  error: unknown,
  pathname = ""
): {
  name: string | null;
  message: string | null;
  stackFirstLine: string | null;
  pathname: string;
  matchedChunkSignature: boolean;
} {
  const record =
    error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const name =
    typeof record.name === "string"
      ? record.name
      : error instanceof Error
        ? error.name
        : null;
  const message =
    typeof record.message === "string"
      ? record.message
      : error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : null;
  const stack =
    typeof record.stack === "string"
      ? record.stack
      : error instanceof Error
        ? error.stack
        : null;
  return {
    name,
    message,
    stackFirstLine: stack?.split("\n")[0] || null,
    pathname,
    matchedChunkSignature: isChunkLoadError(error),
  };
}

export function hasChunkRecoveryGuard(storage: Storage | undefined | null): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(CHUNK_RECOVERY_GUARD_KEY) === "1";
  } catch {
    return false;
  }
}

export function markChunkRecoveryAttempted(storage: Storage | undefined | null): void {
  if (!storage) return;
  try {
    storage.setItem(CHUNK_RECOVERY_GUARD_KEY, "1");
  } catch {}
}

export function clearChunkRecoveryGuard(storage: Storage | undefined | null): void {
  if (!storage) return;
  try {
    storage.removeItem(CHUNK_RECOVERY_GUARD_KEY);
  } catch {}
}

export function shouldAttemptChunkRecovery(error: unknown, storage: Storage | undefined | null): boolean {
  return isChunkLoadError(error) && !hasChunkRecoveryGuard(storage);
}
