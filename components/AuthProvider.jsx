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

const AuthContext = createContext({
  supabase: null,
  authStatus: "loading",
  user: null,
  profile: null,
  role: null,
  error: null,
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
    const user = await getVerifiedUser();
    await applyUserUpdate(user);
  })().finally(() => {
    authStore.bootstrapPromise = null;
  });

  return authStore.bootstrapPromise;
}

function ensureAuthListener() {
  if (authStore.authUnsubscribe) return;
  authStore.authUnsubscribe = subscribeAuthChanges(({ user }) => {
    if (authStore.loggingOut) return;
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

  if (current.pathname === redirectUrl.pathname) {
    const alreadyRedirected =
      current.searchParams.get("redirected") === "1" ||
      redirectUrl.searchParams.get("redirected") === "1";
    if (alreadyRedirected) return;
  }

  redirectUrl.searchParams.set("redirected", "1");
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
      clearVerifiedUserCache();
      updateAuthState(withGuardState(buildSignedOutState()));
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
    clearVerifiedUserCache();
    updateAuthState(withGuardState(buildSignedOutState()));

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
      status: authState.authStatus,
      user: authState.user,
      profile: authState.profile,
      role: authState.role,
      error: authState.error,
      loadingUser:
        authState.authStatus === "loading" || authState.rateLimited,
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
      logout,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
