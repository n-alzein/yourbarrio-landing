import "server-only";

import { headers } from "next/headers";

function sanitizePath(pathValue: string | null | undefined, fallback: string) {
  if (!pathValue) return fallback;
  const value = pathValue.trim();
  if (!value) return fallback;

  try {
    if (value.startsWith("/")) return value;
    const parsed = new URL(value, "http://localhost");
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return fallback;
  }
}

export async function getRequestPath(fallback = "/admin") {
  const headerList = await headers();

  const candidates = [
    headerList.get("x-url"),
    headerList.get("x-invoke-path"),
    headerList.get("next-url"),
    headerList.get("x-pathname"),
  ];

  for (const candidate of candidates) {
    const sanitized = sanitizePath(candidate, "");
    if (sanitized.startsWith("/")) return sanitized;
  }

  return fallback;
}
