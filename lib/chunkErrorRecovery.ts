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

export function isChunkLoadError(error: unknown): boolean {
  const text = collectErrorText(error);
  if (!text) return false;
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(text));
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
