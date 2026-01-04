"use client";

const CRASHLOG_KEY = "__yb_crashlog__";
const MAX_ENTRIES = 50;

const safeNow = () => {
  try {
    return new Date().toISOString();
  } catch {
    return "";
  }
};

const isError = (value) => value instanceof Error;
const isErrorEvent = (value) =>
  typeof ErrorEvent !== "undefined" && value instanceof ErrorEvent;
const isPromiseRejectionEvent = (value) =>
  typeof PromiseRejectionEvent !== "undefined" && value instanceof PromiseRejectionEvent;

const safeSerialize = (value) => {
  try {
    if (isError(value)) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }
    if (isErrorEvent(value)) {
      return {
        type: "ErrorEvent",
        message: value.message,
        filename: value.filename,
        lineno: value.lineno,
        colno: value.colno,
        error: value.error ? safeSerialize(value.error) : undefined,
      };
    }
    if (isPromiseRejectionEvent(value)) {
      return {
        type: "PromiseRejectionEvent",
        reason: safeSerialize(value.reason),
      };
    }
    if (value && typeof value === "object") {
      const output = {};
      const fields = [
        "type",
        "kind",
        "message",
        "reason",
        "error",
        "stack",
        "href",
        "path",
        "status",
        "statusText",
        "filename",
        "lineno",
        "colno",
      ];
      fields.forEach((key) => {
        if (value[key] !== undefined) {
          if (key === "reason" || key === "error") {
            output[key] = safeSerialize(value[key]);
          } else {
            output[key] = value[key];
          }
        }
      });
      // If nothing was picked, attempt a shallow copy of enumerable fields
      if (Object.keys(output).length === 0) {
        return { ...value };
      }
      return output;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value;
    }
    return String(value);
  } catch {
    return "unserializable";
  }
};

function safeRead() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CRASHLOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("[CRASHLOG] read failed", err);
    return [];
  }
}

function safeWrite(entries) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CRASHLOG_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch (err) {
    console.warn("[CRASHLOG] write failed", err);
  }
}

export function appendCrashLog(entry = {}) {
  if (typeof window === "undefined") return;
  const base =
    entry && typeof entry === "object"
      ? safeSerialize(entry)
      : { message: typeof entry === "string" ? entry : String(entry) };
  const next = {
    ...base,
    ts: entry.ts || safeNow(),
    href: entry.href || (typeof window !== "undefined" ? window.location?.href : undefined),
    ua: entry.ua || (typeof window !== "undefined" ? window.navigator?.userAgent : undefined),
  };
  const current = safeRead();
  const merged = [...current, next];
  safeWrite(merged);
  if (process.env.NEXT_PUBLIC_DEBUG_CRASHLOG === "1") {
    console.warn("[CRASHLOG]", next);
  }
}

export function readCrashLog() {
  return safeRead();
}

export function clearCrashLog() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CRASHLOG_KEY);
  } catch {
    /* ignore */
  }
}

export { CRASHLOG_KEY };
