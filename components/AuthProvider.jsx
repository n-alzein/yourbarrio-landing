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
import {
  acknowledgeAuthTokenInvalid,
  getAuthGuardState,
  getBrowserSupabaseClient,
  subscribeAuthGuard,
} from "@/lib/supabaseClient";
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
  refreshProfile: async () => {},
  logout: async () => {},
});

const resolveRole = (profile, user, fallbackRole) => {
  return profile?.role ?? fallbackRole ?? user?.app_metadata?.role ?? null;
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
};

let handledTokenInvalidAt = 0;

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
    updateAuthState(withGuardState(buildSignedOutState()));
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

  authStore.bootstrapPromise = (async () => {
    updateAuthState({ authStatus: "loading", error: null });
    let user = null;
    let sessionChecked = false;
    let sessionError = null;

    if (authStore.supabase?.auth?.getSession) {
      sessionChecked = true;
      try {
        const { data, error } = await authStore.supabase.auth.getSession();
        if (error) {
          sessionError = error;
          setAuthError(error);
        }
        user = data?.session?.user ?? null;
      } catch (err) {
        sessionError = err;
        setAuthError(err);
      }
    }

    if (sessionChecked) {
      if (!user || sessionError) {
        await applyUserUpdate(null);
        return;
      }
    } else if (!user) {
      user = await getVerifiedUser();
    }

    if (!user) {
      await applyUserUpdate(null);
      return;
    }
    await applyUserUpdate(user);
  })().finally(() => {
    authStore.bootstrapPromise = null;
  });

  return authStore.bootstrapPromise;
}

function ensureAuthListener() {
  if (authStore.authUnsubscribe) return;
  authStore.authUnsubscribe = subscribeAuthChanges(({ user, event }) => {
    if (authStore.loggingOut) return;
    if (event) {
      if (event === "SIGNED_OUT") {
        updateAuthState({
          ...buildSignedOutState(),
          rateLimited: false,
          rateLimitUntil: 0,
          rateLimitMessage: null,
          tokenInvalidAt: 0,
          lastAuthEvent: event,
          lastError: null,
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
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const authState = useSyncExternalStore(
    subscribeAuthState,
    getAuthStateSnapshot,
    getAuthStateSnapshot
  );

  const mountedRef = useRef(true);
  const fetchWrappedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    authStore.providerCount += 1;

    if (supabase && !authStore.supabase) {
      authStore.supabase = supabase;
    }

    seedAuthState({
      initialUser,
      initialProfile,
      initialRole,
    });

    ensureAuthGuardSubscription();
    ensureAuthListener();

    if (!authStore.state.user) {
      void bootstrapAuth();
    }

    return () => {
      mountedRef.current = false;
      authStore.providerCount = Math.max(0, authStore.providerCount - 1);
      if (authStore.providerCount === 0) {
        releaseAuthListener();
      }
    };
  }, [initialProfile, initialRole, initialUser, supabase]);

  useEffect(() => {
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
  }, [authState.authStatus]);

  useEffect(() => {
    if (!authState.tokenInvalidAt) return;
    if (authState.tokenInvalidAt <= handledTokenInvalidAt) return;
    handledTokenInvalidAt = authState.tokenInvalidAt;

    (async () => {
      if (authStore.supabase) {
        try {
          await authStore.supabase.auth.signOut({ scope: "local" });
        } catch {
          // best effort
        }
      }
      await cleanupRealtimeChannels();
      clearVerifiedUserCache();
      updateAuthState({
        ...buildSignedOutState(),
        rateLimited: false,
        rateLimitUntil: 0,
        rateLimitMessage: null,
        tokenInvalidAt: 0,
      });
      acknowledgeAuthTokenInvalid(authState.tokenInvalidAt);

      const target =
        authStore.state.role === "business"
          ? PATHS.auth.businessLogin
          : PATHS.auth.customerLogin;
      redirectWithGuard(target);
    })();
  }, [authState.tokenInvalidAt]);

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

  const logout = useCallback(async () => {
    if (!authStore.supabase) {
      if (typeof window !== "undefined") {
        window.location.replace(PATHS.public.root);
      }
      return;
    }

    authStore.loggingOut = true;
    setAuthChangeSuppressed(true);
    updateAuthState({
      ...buildSignedOutState(),
      rateLimited: false,
      rateLimitUntil: 0,
      rateLimitMessage: null,
      tokenInvalidAt: 0,
      lastAuthEvent: "SIGNED_OUT",
      lastError: null,
    });

    await cleanupRealtimeChannels();
    clearVerifiedUserCache();

    if (typeof window !== "undefined") {
      window.location.replace("/api/auth/logout");
    }

    setTimeout(() => {
      try {
        void authStore.supabase.auth.signOut({ scope: "local" });
      } catch {
        // best effort
      }
    }, 0);
  }, []);

  const value = useMemo(
    () => ({
      supabase: authStore.supabase,
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
      refreshProfile,
      logout,
    }),
    [
      authState.authStatus,
      authState.error,
      authState.profile,
      authState.rateLimitMessage,
      authState.rateLimitUntil,
      authState.rateLimited,
      authState.role,
      authState.user,
      authState.lastAuthEvent,
      authState.lastError,
      logout,
      refreshProfile,
    ]
  );

  const diagEnabled =
    process.env.NEXT_PUBLIC_AUTH_DIAG === "1" &&
    process.env.NODE_ENV !== "production";

  useEffect(() => {
    if (!diagEnabled) return;
    console.log("[AUTH_DIAG] status", {
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
    });
  }, [
    authState.authStatus,
    authState.lastAuthEvent,
    authState.lastError,
    authState.profile,
    authState.user,
    diagEnabled,
  ]);

  useEffect(() => {
    if (!diagEnabled || fetchWrappedRef.current) return;
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
  }, [diagEnabled]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      {diagEnabled ? (
        <AuthStateDebug />
      ) : null}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
