const CANONICAL_DOMAIN = ".yourbarrio.com";
const LEGACY_WWW_DOMAIN = "www.yourbarrio.com";

export function getCanonicalCookieDomain(host) {
  if (!host) return undefined;
  const hostname = host.split(":")[0];
  if (hostname.endsWith("yourbarrio.com")) {
    return CANONICAL_DOMAIN;
  }
  return undefined;
}

export function getCookieBaseOptions({ host, isProd }) {
  const domain = isProd ? getCanonicalCookieDomain(host) : undefined;
  return {
    sameSite: "lax",
    secure: Boolean(isProd),
    path: "/",
    ...(domain ? { domain } : {}),
  };
}

function getCookieHeader(req) {
  if (!req?.headers) return "";
  if (typeof req.headers.get === "function") {
    return req.headers.get("cookie") || "";
  }
  return req.headers.cookie || "";
}

export function getSbCookieNamesFromRequest(req) {
  const names = [];
  if (req?.cookies && typeof req.cookies.getAll === "function") {
    req.cookies.getAll().forEach((cookie) => {
      if (cookie?.name?.startsWith("sb-")) {
        names.push(cookie.name);
      }
    });
    return Array.from(new Set(names));
  }

  const cookieHeader = getCookieHeader(req);
  cookieHeader.split(";").forEach((pair) => {
    const trimmed = pair.trim();
    if (!trimmed) return;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) return;
    const name = trimmed.slice(0, eqIndex);
    if (name.startsWith("sb-")) names.push(name);
  });
  return Array.from(new Set(names));
}

export function findDuplicateSbCookieNames(req) {
  const cookieHeader = getCookieHeader(req);
  if (!cookieHeader) return [];
  const counts = new Map();
  cookieHeader.split(";").forEach((pair) => {
    const trimmed = pair.trim();
    if (!trimmed) return;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) return;
    const name = trimmed.slice(0, eqIndex);
    if (!name.startsWith("sb-")) return;
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([name]) => name);
}

export function clearSupabaseCookies(res, req, opts = {}) {
  const { isProd, log, debug } = opts;
  const names = getSbCookieNamesFromRequest(req);
  if (!names.length) return names;

  const clearOptions = {
    path: "/",
    sameSite: "lax",
    secure: Boolean(isProd),
    maxAge: 0,
    expires: new Date(0),
  };
  const domainsToClear = [CANONICAL_DOMAIN, LEGACY_WWW_DOMAIN, undefined];

  names.forEach((name) => {
    domainsToClear.forEach((domain) => {
      res.cookies.set(name, "", {
        ...clearOptions,
        ...(domain ? { domain } : {}),
      });
    });
  });

  if (debug && typeof log === "function") {
    log("cleared supabase cookies (triple-clear)", {
      names,
      domains: [CANONICAL_DOMAIN, LEGACY_WWW_DOMAIN, "(host-only)"],
    });
  }

  return names;
}

export function logSupabaseCookieDiagnostics({ req, debug, log }) {
  if (!debug || typeof log !== "function") return;
  const names = getSbCookieNamesFromRequest(req);
  const duplicates = findDuplicateSbCookieNames(req);
  log("sb cookie snapshot", {
    names,
    duplicates,
  });
}
