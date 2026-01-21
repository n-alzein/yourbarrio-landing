"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  acknowledgeAuthTokenInvalid,
  getAuthGuardState,
  getSupabaseBrowserClient,
  clearSupabaseAuthStorage,
  getCookieName,
  subscribeAuthGuard,
} from "@/lib/supabase/browser";
import {
  clearVerifiedUserCache,
  getVerifiedUser,
  subscribeAuthChanges,
  setAuthChangeSuppressed,
} from "@/lib/auth/verifiedUserClient";
import { PATHS } from "@/lib/auth/paths";
import AuthStateDebug from "@/components/debug/AuthStateDebug";
import { stopRealtime } from "@/lib/realtimeManager";

const AuthContext = createContext({
  supabase: null,
  authStatus: "loading",
  status: "loading",
  user: null,
  profile: null,
  role: null,
  error: null,
  lastAuthEvent: null,
  lastError: null,
  loadingUser: true,
  rateLimited: false,
  rateLimitUntil: 0,
  rateLimitMessage: null,
  refreshDisabledUntil: 0,
  refreshDisabledReason: null,
  authBusy: false,
  authAction: null,
  authAttemptId: 0,
  authActionStartedAt: 0,
  providerInstanceId: null,
  refreshProfile: async () => {},
  logout: async () => {},
  beginAuthAttempt: () => 0,
  endAuthAttempt: () => false,
  resetAuthUiState: () => {},
  seedAuthState: () => {},
});

const resolveRole = (profile, user, fallbackRole) => {
  return profile?.role ?? fallbackRole ?? user?.app_metadata?.role ?? null;
};

const isProtectedPath = (pathname) => {
  if (!pathname) return false;
  if (pathname.startsWith("/business/")) return true;
  if (pathname.startsWith("/customer")) return true;
  if (pathname.startsWith("/account")) return true;
  if (pathname.startsWith("/checkout")) return true;
  if (pathname.startsWith("/orders")) return true;
  return false;
};

const buildSignedOutState = () => ({
  authStatus: "unauthenticated",
  user: null,
  profile: null,
  role: null,
  error: null,
});

const buildSignedInState = ({ user, profile }) => ({
  authStatus: "authenticated",
  user: user ?? null,
  profile: profile ?? null,
  role: resolveRole(profile, user, null),
  error: null,
});

const withGuardState = (base) => ({
  ...base,
  rateLimited: authStore.state.rateLimited,
  rateLimitUntil: authStore.state.rateLimitUntil,
  rateLimitMessage: authStore.state.rateLimitMessage,
  tokenInvalidAt: authStore.state.tokenInvalidAt,
});

const authStore = {
  state: {
    authStatus: "loading",
    user: null,
    profile: null,
    role: null,
    error: null,
    lastAuthEvent: null,
    lastError: null,
    rateLimited: false,
    rateLimitUntil: 0,
    rateLimitMessage: null,
    tokenInvalidAt: 0,
    refreshDisabledUntil: 0,
    refreshDisabledReason: null,
    authBusy: false,
    authAction: null,
    authAttemptId: 0,
    authActionStartedAt: 0,
  },
  listeners: new Set(),
  supabase: null,
  bootstrapPromise: null,
  profilePromise: null,
  profileUserId: null,
  providerCount: 0,
  guardSubscribed: false,
  authUnsubscribe: null,
  loggingOut: false,
  providerInstanceId: null,
  bootstrapAbortController: null,
};

let handledTokenInvalidAt = 0;
const authDiagEnabled =
  process.env.NEXT_PUBLIC_AUTH_DIAG === "1" &&
  process.env.NODE_ENV !== "production";
export const AUTH_UI_RESET_EVENT = "yb-auth-ui-reset";

let authClickTracerRefs = 0;
let authClickTracerCleanup = null;

function emitAuthState() {
  authStore.listeners.forEach((listener) => listener());
}

function setAuthState(nextState) {
  authStore.state = nextState;
  emitAuthState();
}

function updateAuthState(partial) {
  setAuthState({ ...authStore.state, ...partial });
}

function logAuthDiag(event, payload = {}) {
  if (!authDiagEnabled || typeof window === "undefined") return;
  console.log("[AUTH_DIAG]", {
    event,
    pathname: window.location.pathname,
    authStatus: authStore.state.authStatus,
    authBusy: authStore.state.authBusy,
    authAction: authStore.state.authAction,
    authAttemptId: authStore.state.authAttemptId,
    providerInstanceId: authStore.providerInstanceId,
    userId: authStore.state.user?.id ?? null,
    ...payload,
  });
}

function emitAuthUiReset(reason) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(AUTH_UI_RESET_EVENT, {
      detail: { reason, ts: Date.now() },
    })
  );
  logAuthDiag("ui:reset", { reason });
}

function clearSupabaseCookiesClient() {
  if (typeof document === "undefined") return;
  const cookieName = getCookieName();
  const names = document.cookie
    .split(";")
    .map((entry) => entry.trim().split("=")[0])
    .filter(Boolean)
    .filter((name) => name.startsWith("sb-") || name === cookieName);

  const hostname = window.location.hostname || "";
  const domains = [undefined];
  if (hostname.endsWith("yourbarrio.com")) {
    domains.push(".yourbarrio.com", "www.yourbarrio.com");
  }

  names.forEach((name) => {
    domains.forEach((domain) => {
      const domainAttr = domain ? `domain=${domain};` : "";
      document.cookie = `${name}=; ${domainAttr} path=/; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    });
  });

  try {
    localStorage.removeItem("business_auth_redirect");
    localStorage.removeItem("business_auth_success");
    localStorage.removeItem("signup_role");
  } catch {
    // ignore
  }
  try {
    sessionStorage.removeItem("yb_auto_logged_out");
    sessionStorage.removeItem("auth_flow_id");
  } catch {
    // ignore
  }
}

function describeNode(node) {
  if (!node || !node.tagName) return null;
  const id = node.id ? `#${node.id}` : "";
  const className =
    typeof node.className === "string" && node.className.trim()
      ? `.${node.className.trim().split(/\s+/).slice(0, 3).join(".")}`
      : "";
  return `${node.tagName.toLowerCase()}${id}${className}`;
}

function attachAuthClickTracer() {
  if (typeof window === "undefined") return () => {};
  const overlaySelectors = [
    "div[data-mobile-sidebar-drawer=\"1\"]",
    "#modal-root",
    "[aria-modal=\"true\"]",
  ];

  const handler = (event) => {
    const x = typeof event.clientX === "number" ? event.clientX : null;
    const y = typeof event.clientY === "number" ? event.clientY : null;
    const target = event.target;
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    const pathSummary = path
      .slice(0, 6)
      .map((node) => describeNode(node))
      .filter(Boolean);
    const hit =
      x !== null && y !== null ? document.elementFromPoint(x, y) : null;
    const nav =
      document.querySelector("nav[data-nav-guard]") ||
      document.querySelector("nav[data-business-navbar]") ||
      document.querySelector("nav[data-nav-surface]") ||
      document.querySelector("nav[data-public-nav]") ||
      document.querySelector("nav");
    const overlayNodes = overlaySelectors
      .map((selector) => ({ selector, node: document.querySelector(selector) }))
      .filter(({ node }) => node);
    const overlayHit = overlayNodes.find(({ node }) => hit && node.contains(hit));

    console.log("[AUTH_DIAG] click:capture", {
      type: event.type,
      coords: { x, y },
      target: describeNode(target),
      path: pathSummary,
      elementFromPoint: describeNode(hit),
      inNavbar: Boolean(nav && hit && nav.contains(hit)),
      overlayHit: overlayHit
        ? { selector: overlayHit.selector, node: describeNode(overlayHit.node) }
        : null,
    });
  };

  window.addEventListener("pointerdown", handler, true);
  window.addEventListener("click", handler, true);
  return () => {
    window.removeEventListener("pointerdown", handler, true);
    window.removeEventListener("click", handler, true);
  };
}

function buildAuthUiResetState(reason) {
  const nextAttemptId = authStore.state.authAttemptId + 1;
  logAuthDiag("auth_ui:reset", { reason, nextAttemptId });
  return {
    authBusy: false,
    authAction: null,
    authAttemptId: nextAttemptId,
    authActionStartedAt: 0,
  };
}

function applySignedOutState(reason = "signed_out", options = {}) {
  const {
    resetGuardState = false,
    clearAuthSuppression = false,
    extraState = null,
    resetAuthUi = true,
  } = options;

  if (authStore.bootstrapAbortController?.abort) {
    authStore.bootstrapAbortController.abort();
  }
  authStore.bootstrapAbortController = null;
  authStore.bootstrapPromise = null;
  authStore.profilePromise = null;
  authStore.profileUserId = null;

  if (clearAuthSuppression) {
    authStore.loggingOut = false;
    setAuthChangeSuppressed(false);
  }

  const signedOutBase = resetGuardState
    ? {
        ...buildSignedOutState(),
        rateLimited: false,
        rateLimitUntil: 0,
        rateLimitMessage: null,
        tokenInvalidAt: 0,
      }
    : withGuardState(buildSignedOutState());

  const authUiState = resetAuthUi
    ? buildAuthUiResetState(`signed_out:${reason}`)
    : null;

  updateAuthState({
    ...signedOutBase,
    ...(authUiState || {}),
    ...(extraState || {}),
  });

  logAuthDiag("auth:signed_out:applied", { reason, resetGuardState });
}

function beginAuthAttempt(action) {
  const nextAttemptId = authStore.state.authAttemptId + 1;
  updateAuthState({
    authBusy: true,
    authAction: action || null,
    authAttemptId: nextAttemptId,
    authActionStartedAt: Date.now(),
    lastError: null,
  });
  logAuthDiag("auth:attempt:begin", { action, attemptId: nextAttemptId });
  return nextAttemptId;
}

function endAuthAttempt(attemptId, result) {
  if (attemptId !== authStore.state.authAttemptId) {
    logAuthDiag("auth:attempt:end:ignored", {
      attemptId,
      currentAttemptId: authStore.state.authAttemptId,
      result,
    });
    return false;
  }

  updateAuthState({
    authBusy: false,
    authAction: null,
    authActionStartedAt: 0,
  });
  logAuthDiag("auth:attempt:end", { attemptId, result });
  return true;
}

function resetAuthUiState(reason) {
  updateAuthState(buildAuthUiResetState(reason));
}

async function cleanupRealtimeChannels() {
  await stopRealtime(authStore.supabase);
}

function setAuthError(error) {
  if (!error) return;
  const message = error?.message || String(error);
  updateAuthState({
    error,
    lastError: message,
  });
}

function subscribeAuthState(listener) {
  authStore.listeners.add(listener);
  return () => {
    authStore.listeners.delete(listener);
  };
}

function getAuthStateSnapshot() {
  return authStore.state;
}

function seedAuthState({ initialUser, initialProfile, initialRole }) {
  if (!initialUser && !initialProfile && !initialRole) {
    return;
  }

  const nextState = { ...authStore.state };
  let changed = false;

  if (initialUser && !nextState.user) {
    nextState.user = initialUser;
    nextState.authStatus = "authenticated";
    changed = true;
  }

  if (initialProfile && !nextState.profile) {
    nextState.profile = initialProfile;
    changed = true;
  }

  if (initialRole && !nextState.role) {
    nextState.role = initialRole;
    changed = true;
  }

  if (changed) {
    nextState.role = resolveRole(nextState.profile, nextState.user, nextState.role);
    setAuthState(nextState);
  }
}

function syncAuthGuardState(guard) {
  const rateLimited = guard.cooldownMsRemaining > 0;
  const rateLimitUntil = guard.cooldownUntil || 0;
  const rateLimitMessage = rateLimited
    ? "We're having trouble connecting. Please wait a moment."
    : null;

  const next = { ...authStore.state };
  let changed = false;

  if (next.rateLimited !== rateLimited) {
    next.rateLimited = rateLimited;
    changed = true;
  }

  if (next.rateLimitUntil !== rateLimitUntil) {
    next.rateLimitUntil = rateLimitUntil;
    changed = true;
  }

  if (next.rateLimitMessage !== rateLimitMessage) {
    next.rateLimitMessage = rateLimitMessage;
    changed = true;
  }

  if (guard.tokenInvalidAt && next.tokenInvalidAt !== guard.tokenInvalidAt) {
    next.tokenInvalidAt = guard.tokenInvalidAt;
    changed = true;
  }

  if (typeof guard.refreshDisabledUntil === "number") {
    if (next.refreshDisabledUntil !== guard.refreshDisabledUntil) {
      next.refreshDisabledUntil = guard.refreshDisabledUntil;
      changed = true;
    }
  }

  if (next.refreshDisabledReason !== (guard.refreshDisabledReason || null)) {
    next.refreshDisabledReason = guard.refreshDisabledReason || null;
    changed = true;
  }

  if (changed) {
    setAuthState(next);
  }
}

function ensureAuthGuardSubscription() {
  if (authStore.guardSubscribed) return;
  authStore.guardSubscribed = true;
  syncAuthGuardState(getAuthGuardState());
  subscribeAuthGuard((guard) => {
    syncAuthGuardState(guard);
  });
}

async function fetchProfile(user) {
  if (!authStore.supabase || !user?.id) {
    return { profile: null, error: null };
  }
  const { data, error } = await authStore.supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  return { profile: data ?? null, error };
}

async function getProfileForUser(user) {
  if (!user?.id) return { profile: null, error: null };
  if (authStore.profilePromise && authStore.profileUserId === user.id) {
    return authStore.profilePromise;
  }
  if (authStore.profileUserId === user.id && authStore.state.profile) {
    return { profile: authStore.state.profile, error: null };
  }

  authStore.profileUserId = user.id;
  authStore.profilePromise = fetchProfile(user)
    .finally(() => {
      authStore.profilePromise = null;
    });
  return authStore.profilePromise;
}

async function applyUserUpdate(user) {
  const currentId = authStore.state.user?.id || null;
  const nextId = user?.id || null;
  const nextStatus = user ? "authenticated" : "unauthenticated";
  const statusChanged = authStore.state.authStatus !== nextStatus;
  const needsProfile =
    Boolean(user) &&
    (!authStore.state.profile || authStore.profileUserId !== nextId);

  if (currentId === nextId && !statusChanged && !needsProfile) {
    return;
  }

  if (!user) {
    applySignedOutState("apply_user_update", {
      resetGuardState: false,
      clearAuthSuppression: true,
    });
    return;
  }

  if (currentId !== nextId || statusChanged) {
    updateAuthState({
      ...withGuardState(buildSignedInState({ user })),
      profile: authStore.state.profile,
      role: resolveRole(authStore.state.profile, user, authStore.state.role),
    });
  }

  const { profile } = await getProfileForUser(user);
  if (authStore.state.user?.id !== user.id) return;
  updateAuthState({
    profile,
    role: resolveRole(profile, user, authStore.state.role),
  });
}

async function bootstrapAuth() {
  if (authStore.bootstrapPromise) return authStore.bootstrapPromise;

  const abortController = new AbortController();
  authStore.bootstrapAbortController = abortController;
  const { signal } = abortController;

  authStore.bootstrapPromise = (async () => {
    updateAuthState({ authStatus: "loading", error: null });
    let user = null;
    let sessionChecked = false;
    let sessionError = null;

    if (signal.aborted) {
      logAuthDiag("auth:bootstrap:aborted", { step: "start" });
      return;
    }

    if (authStore.supabase?.auth?.getSession) {
      const guard = getAuthGuardState();
      if (guard.refreshDisabledMsRemaining > 0 || guard.cooldownMsRemaining > 0) {
        logAuthDiag("auth:bootstrap:skip", {
          reason:
            guard.refreshDisabledMsRemaining > 0
              ? "refresh_disabled"
              : "rate_limited",
          refreshDisabledMsRemaining: guard.refreshDisabledMsRemaining,
          cooldownMsRemaining: guard.cooldownMsRemaining,
        });
      } else {
        sessionChecked = true;
        try {
          const { data, error } = await authStore.supabase.auth.getSession();
          if (error) {
            sessionError = error;
            setAuthError(error);
          }
          user = data?.session?.user ?? null;
          logAuthDiag("auth:getSession:result", {
            ok: !error,
            hasUser: Boolean(user),
            sessionUserId: user?.id ?? null,
            error: error?.message ?? null,
          });
        } catch (err) {
          sessionError = err;
          setAuthError(err);
          logAuthDiag("auth:getSession:result", {
            ok: false,
            hasUser: false,
            sessionUserId: null,
            error: err?.message ?? String(err),
          });
        }
      }
    }

    if (signal.aborted) {
      logAuthDiag("auth:bootstrap:aborted", { step: "session" });
      return;
    }

    if (sessionChecked) {
      if (!user || sessionError) {
        applySignedOutState("bootstrap:no_session", {
          resetGuardState: false,
          clearAuthSuppression: true,
        });
        return;
      }
    } else if (!user) {
      user = await getVerifiedUser();
    }

    if (signal.aborted) {
      logAuthDiag("auth:bootstrap:aborted", { step: "verified_user" });
      return;
    }

    if (!user) {
      applySignedOutState("bootstrap:no_user", {
        resetGuardState: false,
        clearAuthSuppression: true,
      });
      return;
    }
    await applyUserUpdate(user);
  })().finally(() => {
    if (authStore.bootstrapAbortController === abortController) {
      authStore.bootstrapAbortController = null;
    }
    authStore.bootstrapPromise = null;
  });

  return authStore.bootstrapPromise;
}

function ensureAuthListener() {
  if (authStore.authUnsubscribe) return;
  authStore.authUnsubscribe = subscribeAuthChanges(({ user, event }) => {
    if (authStore.loggingOut) return;
    if (event) {
      logAuthDiag("auth:event", {
        event,
        hasUser: Boolean(user),
        sessionUserId: user?.id ?? null,
      });
      if (event === "SIGNED_OUT") {
        emitAuthUiReset("auth_event:signed_out");
        applySignedOutState("auth_event:signed_out", {
          resetGuardState: true,
          clearAuthSuppression: true,
          extraState: {
            lastAuthEvent: event,
            lastError: null,
          },
        });
        void cleanupRealtimeChannels();
        return;
      }
      updateAuthState({ lastAuthEvent: event });
    }
    void applyUserUpdate(user);
  });
}

function releaseAuthListener() {
  if (!authStore.authUnsubscribe) return;
  authStore.authUnsubscribe();
  authStore.authUnsubscribe = null;
}

function redirectWithGuard(target) {
  if (typeof window === "undefined") return;
  const current = new URL(window.location.href);
  const redirectUrl = new URL(target, window.location.origin);

  const nextPath = `${redirectUrl.pathname}${redirectUrl.search}`;
  if (`${current.pathname}${current.search}` === nextPath) {
    return;
  }

  window.location.replace(nextPath);
}

export function AuthProvider({
  children,
  initialUser = null,
  initialProfile = null,
  initialRole = null,
}) {
  const parentAuth = useContext(AuthContext);
  const isNestedProviderRef = useRef(Boolean(parentAuth?.providerInstanceId));
  const isNestedProvider = isNestedProviderRef.current;
  const authDiagEnabledLocal = useMemo(
    () =>
      process.env.NEXT_PUBLIC_AUTH_DIAG === "1" &&
      process.env.NODE_ENV !== "production",
    []
  );
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const authState = useSyncExternalStore(
    subscribeAuthState,
    getAuthStateSnapshot,
    getAuthStateSnapshot
  );

  const mountedRef = useRef(true);
  const fetchWrappedRef = useRef(false);
  const providerInstanceIdRef = useRef(
    `auth-${Math.random().toString(36).slice(2, 10)}`
  );
  const authUiFailsafeTimerRef = useRef(null);
  const pathname = usePathname();
  const router = useRouter();
  const lastKnownRoleRef = useRef(null);

  useEffect(() => {
    if (authState.role) {
      lastKnownRoleRef.current = authState.role;
    }
  }, [authState.role]);

  useEffect(() => {
    if (isNestedProvider) return;
    if (typeof window === "undefined") return;
    const event = authState.lastAuthEvent;
    if (!event) return;
    if (!["SIGNED_IN", "SIGNED_OUT", "TOKEN_REFRESHED"].includes(event)) {
      return;
    }
    logAuthDiag("router:refresh", { event });
    router.refresh();
  }, [authState.lastAuthEvent, isNestedProvider, router]);

  useEffect(() => {
    if (isNestedProvider) return;
    if (authState.lastAuthEvent !== "SIGNED_OUT") return;
    if (!pathname) return;
    if (!isProtectedPath(pathname)) return;
    const target = pathname.startsWith("/business")
      ? PATHS.auth.businessLogin
      : PATHS.auth.customerLogin;
    if (pathname === target || pathname === `${target}/`) return;
    logAuthDiag("route_guard:signed_out_redirect", { from: pathname, to: target });
    router.replace(target);
    router.refresh();
  }, [authState.lastAuthEvent, isNestedProvider, pathname, router]);

  useEffect(() => {
    mountedRef.current = true;
    authStore.providerCount += 1;
    authStore.providerInstanceId = providerInstanceIdRef.current;
    if (authDiagEnabledLocal && authStore.providerCount > 1) {
      console.warn("[AUTH_DIAG] provider:multiple", {
        providerInstanceId: providerInstanceIdRef.current,
        providerCount: authStore.providerCount,
        pathname: typeof window !== "undefined" ? window.location.pathname : null,
      });
    }

    if (supabase && !authStore.supabase) {
      authStore.supabase = supabase;
    }

    seedAuthState({
      initialUser,
      initialProfile,
      initialRole,
    });

    if (!isNestedProvider) {
      ensureAuthGuardSubscription();
      ensureAuthListener();

      if (!authStore.state.user) {
        void bootstrapAuth();
      }
    }

    return () => {
      mountedRef.current = false;
      authStore.providerCount = Math.max(0, authStore.providerCount - 1);
      if (authStore.providerCount === 0) {
        releaseAuthListener();
      }
    };
  }, [
    initialProfile,
    initialRole,
    initialUser,
    isNestedProvider,
    supabase,
    authDiagEnabledLocal,
  ]);

  useEffect(() => {
    if (!authDiagEnabledLocal) return undefined;
    authClickTracerRefs += 1;
    if (authClickTracerRefs === 1) {
      authClickTracerCleanup = attachAuthClickTracer();
    }
    return () => {
      authClickTracerRefs = Math.max(0, authClickTracerRefs - 1);
      if (authClickTracerRefs === 0 && authClickTracerCleanup) {
        authClickTracerCleanup();
        authClickTracerCleanup = null;
      }
    };
  }, [authDiagEnabledLocal]);

  useEffect(() => {
    if (isNestedProvider) return;
    if (!pathname) return;
    emitAuthUiReset("route_change");
  }, [isNestedProvider, pathname]);

  useEffect(() => {
    if (isNestedProvider) return undefined;
    if (process.env.NODE_ENV === "production") return undefined;
    if (authState.authStatus !== "loading") return undefined;
    const timer = setTimeout(() => {
      if (authStore.state.authStatus === "loading") {
        console.warn(
          "[AUTH_DIAG] authStatus still loading after 2s",
          authStore.state
        );
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [authState.authStatus, isNestedProvider]);

  useEffect(() => {
    if (isNestedProvider) return;
    if (!authState.tokenInvalidAt) return;
    if (authState.tokenInvalidAt <= handledTokenInvalidAt) return;
    handledTokenInvalidAt = authState.tokenInvalidAt;

    (async () => {
      logAuthDiag("auth:token_invalid:handle", {
        tokenInvalidAt: authState.tokenInvalidAt,
      });
      clearSupabaseAuthStorage();
      if (authStore.supabase) {
        try {
          await authStore.supabase.auth.signOut({ scope: "local" });
        } catch {
          // best effort
        }
      }
      await cleanupRealtimeChannels();
      clearVerifiedUserCache();
      applySignedOutState("token_invalid", {
        resetGuardState: true,
        clearAuthSuppression: true,
      });
      acknowledgeAuthTokenInvalid(authState.tokenInvalidAt);

      const target =
        authStore.state.role === "business"
          ? PATHS.auth.businessLogin
          : PATHS.auth.customerLogin;
      redirectWithGuard(target);
    })();
  }, [authState.tokenInvalidAt, isNestedProvider]);

  const refreshProfile = useCallback(async () => {
    if (!mountedRef.current || !authStore.supabase || !authState.user?.id) {
      return;
    }
    const { profile, error } = await fetchProfile(authState.user);
    if (error || !mountedRef.current) return;
    updateAuthState({
      profile,
      role: resolveRole(profile, authState.user, authState.role),
    });
  }, [authState.role, authState.user]);

  const resetAuthUiStateCb = useCallback((reason) => {
    resetAuthUiState(reason);
  }, []);

  const seedAuthStateCb = useCallback((payload) => {
    seedAuthState(payload);
  }, []);

  const logout = useCallback(
    async (options = {}) => {
      const { redirectTo, reason = "logout" } = options;
      const role = authStore.state.role;
      const inferredRole =
        role ||
        (typeof window !== "undefined" &&
        window.location.pathname.startsWith("/business")
          ? "business"
          : "customer");
      const resolvedRedirect =
        redirectTo ||
        (inferredRole === "business"
          ? PATHS.public.businessLanding
          : PATHS.auth.customerLogin);
      const shouldRedirect = typeof window !== "undefined";

      resetAuthUiState("logout:pre");
      emitAuthUiReset("logout:pre");
      authStore.loggingOut = true;
      setAuthChangeSuppressed(true);
      applySignedOutState("logout:pre", {
        resetGuardState: true,
        resetAuthUi: false,
        extraState: {
          lastAuthEvent: "SIGNED_OUT",
          lastError: null,
        },
      });

      logAuthDiag("logout", {
        hasUser: Boolean(authStore.state.user),
        authStatus: authStore.state.authStatus,
        authBusy: authStore.state.authBusy,
        reason,
        role,
        redirectTo: resolvedRedirect,
      });

      try {
        try {
          await cleanupRealtimeChannels();
        } catch (err) {
          logAuthDiag("logout:realtime:error", {
            message: err?.message || String(err),
          });
        }
        clearVerifiedUserCache();
        clearSupabaseAuthStorage();
        clearSupabaseCookiesClient();
        if (authStore.supabase?.auth?.signOut) {
          try {
            await authStore.supabase.auth.signOut({ scope: "local" });
          } catch (err) {
            logAuthDiag("logout:supabase:error", {
              message: err?.message || String(err),
            });
          }
        }

        if (shouldRedirect) {
          try {
            await fetch("/api/auth/signout", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
            });
          } catch (err) {
            logAuthDiag("logout:server:error", {
              message: err?.message || String(err),
            });
          }
        }
      } finally {
        resetAuthUiState("logout:finally");
        if (shouldRedirect) {
          router.replace(resolvedRedirect);
          router.refresh();
        }
      }
    },
    [router]
  );

  const value = useMemo(
    () => ({
      supabase: authStore.supabase ?? supabase,
      authStatus: authState.authStatus,
      status:
        authState.authStatus === "authenticated"
          ? "signed_in"
          : authState.authStatus === "unauthenticated"
            ? "signed_out"
            : "loading",
      user: authState.user,
      profile: authState.profile,
      role: authState.role,
      error: authState.error,
      lastAuthEvent: authState.lastAuthEvent,
      lastError: authState.lastError,
      loadingUser:
        authState.authStatus === "loading",
      rateLimited: authState.rateLimited,
      rateLimitUntil: authState.rateLimitUntil,
      rateLimitMessage: authState.rateLimitMessage,
      refreshDisabledUntil: authState.refreshDisabledUntil,
      refreshDisabledReason: authState.refreshDisabledReason,
      authBusy: authState.authBusy,
      authAction: authState.authAction,
      authAttemptId: authState.authAttemptId,
      authActionStartedAt: authState.authActionStartedAt,
      providerInstanceId: providerInstanceIdRef.current,
      refreshProfile,
      logout,
      beginAuthAttempt,
      endAuthAttempt,
      resetAuthUiState: resetAuthUiStateCb,
      seedAuthState: seedAuthStateCb,
    }),
    [
      authState.authStatus,
      authState.error,
      authState.profile,
      authState.rateLimitMessage,
      authState.rateLimitUntil,
      authState.rateLimited,
      authState.refreshDisabledReason,
      authState.refreshDisabledUntil,
      authState.role,
      authState.user,
      authState.lastAuthEvent,
      authState.lastError,
      authState.authBusy,
      authState.authAction,
      authState.authAttemptId,
      authState.authActionStartedAt,
      supabase,
      logout,
      refreshProfile,
      resetAuthUiStateCb,
      seedAuthStateCb,
    ]
  );

  useEffect(() => {
    if (isNestedProvider) return;
    if (!authDiagEnabledLocal) return;
    console.log("[AUTH_DIAG] status", {
      providerInstanceId: providerInstanceIdRef.current,
      authStatus: authState.authStatus,
      status:
        authState.authStatus === "authenticated"
          ? "signed_in"
          : authState.authStatus === "unauthenticated"
            ? "signed_out"
            : "loading",
      hasUser: Boolean(authState.user),
      hasProfile: Boolean(authState.profile),
      lastAuthEvent: authState.lastAuthEvent,
      lastError: authState.lastError,
      authBusy: authState.authBusy,
      authAction: authState.authAction,
      authAttemptId: authState.authAttemptId,
      authActionStartedAt: authState.authActionStartedAt,
    });
  }, [
    authState.authStatus,
    authState.authAction,
    authState.authAttemptId,
    authState.authBusy,
    authState.authActionStartedAt,
    authState.lastAuthEvent,
    authState.lastError,
    authState.profile,
    authState.user,
    authDiagEnabledLocal,
    isNestedProvider,
  ]);

  useEffect(() => {
    if (isNestedProvider) return;
    if (!authDiagEnabledLocal || fetchWrappedRef.current) return;
    if (typeof window === "undefined" || typeof window.fetch !== "function") return;
    fetchWrappedRef.current = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const input = args[0];
      const init = args[1] || {};
      const url = typeof input === "string" ? input : input?.url || "";
      const requestHeaders =
        input instanceof Request
          ? input.headers
          : new Headers(init?.headers || {});
      const hasRscHeader = requestHeaders.has("RSC") || requestHeaders.has("rsc");
      const isRedirectParam = url.includes("redirected=1");
      const response = await originalFetch(...args);

      if (
        (hasRscHeader || isRedirectParam) &&
        (response.redirected || response.status >= 300)
      ) {
        console.warn("[AUTH_DIAG] fetch:rsc", {
          url,
          status: response.status,
          redirected: response.redirected,
          location: response.headers.get("location"),
          authStatus: authStore.state.authStatus,
          stack: new Error().stack,
        });
      }

      if (response.status === 401 || response.status === 403) {
        console.warn("[AUTH_DIAG] fetch:unauthorized", {
          url,
          status: response.status,
          authStatus: authStore.state.authStatus,
          stack: new Error().stack,
        });
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
      fetchWrappedRef.current = false;
    };
  }, [authDiagEnabledLocal, isNestedProvider]);

  useEffect(() => {
    if (isNestedProvider) return;
    if (authState.authStatus !== "unauthenticated" || authState.user) return;
    if (authStore.loggingOut) {
      authStore.loggingOut = false;
      setAuthChangeSuppressed(false);
    }
  }, [authState.authStatus, authState.user, isNestedProvider]);

  useEffect(() => {
    if (isNestedProvider) return;
    if (typeof window === "undefined") return;
    if (authState.authStatus !== "unauthenticated" || authState.user) return;
    if (!pathname) return;
    if (pathname.startsWith("/business-auth")) return;

    const target = pathname.startsWith("/business/")
      ? PATHS.auth.businessLogin
      : pathname.startsWith("/business")
        ? PATHS.public.businessLanding
        : PATHS.auth.customerLogin;
    if (pathname === target || pathname === `${target}/`) return;

    logAuthDiag("route_guard:client_redirect", {
      from: pathname,
      to: target,
      role: lastKnownRoleRef.current,
    });
    router.replace(target);
    router.refresh();
  }, [authState.authStatus, authState.user, isNestedProvider, pathname, router]);

  useEffect(() => {
    if (isNestedProvider) return;
    if (typeof window === "undefined") return;
    if (authState.authStatus !== "authenticated" || !authState.user) return;
    if (!pathname) return;
    if (!pathname.startsWith("/business-auth")) return;

    const target =
      authState.role === "business"
        ? PATHS.business.dashboard
        : PATHS.customer.home;
    if (pathname === target || pathname === `${target}/`) return;

    logAuthDiag("route_guard:auth_redirect", {
      from: pathname,
      to: target,
      role: authState.role,
    });
    router.replace(target);
    router.refresh();
  }, [
    authState.authStatus,
    authState.role,
    authState.user,
    isNestedProvider,
    pathname,
    router,
  ]);

  useEffect(() => {
    if (isNestedProvider) return;
    if (authState.authStatus !== "unauthenticated" || authState.user) {
      if (authUiFailsafeTimerRef.current) {
        clearTimeout(authUiFailsafeTimerRef.current);
        authUiFailsafeTimerRef.current = null;
      }
      return;
    }
    if (!authState.authBusy && !authState.authAction) {
      if (authUiFailsafeTimerRef.current) {
        clearTimeout(authUiFailsafeTimerRef.current);
        authUiFailsafeTimerRef.current = null;
      }
      return;
    }

    const startedAt = authState.authActionStartedAt || 0;
    const ageMs = startedAt ? Date.now() - startedAt : 0;
    const remainingMs = startedAt ? Math.max(0, 5000 - ageMs) : 0;

    if (remainingMs === 0) {
      logAuthDiag("auth_ui:failsafe", {
        ageMs,
        authAction: authState.authAction,
        authAttemptId: authState.authAttemptId,
      });
      updateAuthState({
        authBusy: false,
        authAction: null,
        authActionStartedAt: 0,
      });
      return;
    }

    if (authUiFailsafeTimerRef.current) {
      clearTimeout(authUiFailsafeTimerRef.current);
    }
    authUiFailsafeTimerRef.current = setTimeout(() => {
      authUiFailsafeTimerRef.current = null;
      if (authStore.state.authStatus !== "unauthenticated") return;
      if (authStore.state.user) return;
      logAuthDiag("auth_ui:failsafe", {
        ageMs: Date.now() - startedAt,
        authAction: authStore.state.authAction,
        authAttemptId: authStore.state.authAttemptId,
      });
      updateAuthState({
        authBusy: false,
        authAction: null,
        authActionStartedAt: 0,
      });
    }, remainingMs);
  }, [
    authState.authAction,
    authState.authBusy,
    authState.authActionStartedAt,
    authState.authStatus,
    authState.user,
    authState.authAttemptId,
    isNestedProvider,
  ]);

  return (
    isNestedProvider ? (
      <>{children}</>
    ) : (
      <AuthContext.Provider value={value}>
        {children}
        {authDiagEnabledLocal ? (
          <AuthStateDebug />
        ) : null}
      </AuthContext.Provider>
    )
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
