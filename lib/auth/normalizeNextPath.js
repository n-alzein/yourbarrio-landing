function rewriteLegacyOnboardingPath(path) {
  if (typeof path !== "string") return null;
  if (path === "/business/onboarding") return "/onboarding";
  if (path.startsWith("/business/onboarding/")) {
    return `/onboarding/${path.slice("/business/onboarding/".length)}`;
  }
  return path;
}

export function normalizeNextPath(input) {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      candidate = `${parsed.pathname || ""}${parsed.search || ""}`;
    } catch {
      return null;
    }
  }

  if (!candidate.startsWith("/")) return null;
  if (candidate.startsWith("//")) return null;

  const [rawPathname = "", query = ""] = candidate.split("?");
  const rewrittenPathname = rewriteLegacyOnboardingPath(rawPathname);
  if (!rewrittenPathname) return null;
  if (!query) return rewrittenPathname;
  return `${rewrittenPathname}?${query}`;
}

