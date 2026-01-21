import { PATHS } from "@/lib/auth/paths";

const BLOCKED_PREFIXES = ["/business-auth"];

export function getSafeRedirectPath(next, origin) {
  if (!next || !origin) return null;
  const trimmed = String(next).trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed, origin);
    if (url.origin !== origin) return null;
    const path = `${url.pathname}${url.search}${url.hash}`;
    if (!path.startsWith("/")) return null;
    return path;
  } catch {
    return null;
  }
}

export function resolvePostLoginTarget({ role, next, origin }) {
  const fallback =
    role === "business" ? PATHS.business.dashboard : PATHS.customer.home;
  const safeNext = getSafeRedirectPath(next, origin);
  if (!safeNext) return fallback;
  if (BLOCKED_PREFIXES.some((prefix) => safeNext.startsWith(prefix))) {
    return fallback;
  }
  if (role !== "business" && safeNext.startsWith("/business")) {
    return fallback;
  }
  return safeNext;
}
