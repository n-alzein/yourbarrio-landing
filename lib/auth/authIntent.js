import { getSafeRedirectPath } from "@/lib/auth/redirects";
import { PATHS } from "@/lib/auth/paths";

export const POST_LOGIN_REDIRECT_STORAGE_KEY = "yb:postLoginRedirect";
export const LOGIN_ROLE_STORAGE_KEY = "yb:loginRole";

function getWindowSessionStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function sanitizeAuthRedirectPath(input, fallbackPath = PATHS.public.root) {
  const safeFallback = getSafeRedirectPath(fallbackPath) || PATHS.public.root;
  const safePath = getSafeRedirectPath(input);
  return safePath || safeFallback;
}

export function setAuthIntent({ redirectTo, role } = {}) {
  const storage = getWindowSessionStorage();
  if (!storage) return null;

  const normalizedRole = role === "business" ? "business" : "customer";
  const fallbackPath =
    normalizedRole === "business"
      ? PATHS.public.businessLanding
      : PATHS.public.root;
  const safeRedirect = sanitizeAuthRedirectPath(redirectTo, fallbackPath);

  storage.setItem(POST_LOGIN_REDIRECT_STORAGE_KEY, safeRedirect);
  storage.setItem(LOGIN_ROLE_STORAGE_KEY, normalizedRole);
  return safeRedirect;
}

export function readAuthIntent() {
  const storage = getWindowSessionStorage();
  if (!storage) return { redirectTo: null, role: null };

  return {
    redirectTo: sanitizeAuthRedirectPath(
      storage.getItem(POST_LOGIN_REDIRECT_STORAGE_KEY),
      PATHS.public.root
    ),
    role: storage.getItem(LOGIN_ROLE_STORAGE_KEY) || null,
  };
}

export function clearAuthIntent() {
  const storage = getWindowSessionStorage();
  if (!storage) return;
  storage.removeItem(POST_LOGIN_REDIRECT_STORAGE_KEY);
  storage.removeItem(LOGIN_ROLE_STORAGE_KEY);
}

export function consumeAuthIntent({ role, fallbackPath } = {}) {
  const { redirectTo, role: storedRole } = readAuthIntent();
  const normalizedRole = role || storedRole || "customer";
  const resolvedFallback =
    fallbackPath ||
    (normalizedRole === "business"
      ? PATHS.public.businessLanding
      : PATHS.public.root);
  const safeRedirect = sanitizeAuthRedirectPath(redirectTo, resolvedFallback);
  clearAuthIntent();
  return safeRedirect;
}

export function requestCustomerLogin({ router, redirectTo } = {}) {
  setAuthIntent({ redirectTo, role: "customer" });
  router?.push(PATHS.auth.customerLogin);
}

export function requestBusinessLogin({ router, redirectTo } = {}) {
  setAuthIntent({ redirectTo, role: "business" });
  router?.push(PATHS.auth.businessLogin);
}
