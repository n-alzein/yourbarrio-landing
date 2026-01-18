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
import { PATHS } from "@/lib/auth/paths";

const AuthContext = createContext({
  supabase: null,
  status: "loading",
  session: null,
  authUser: null,
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

const resolveRole = (profile, authUser, fallbackRole) => {
  return profile?.role ?? fallbackRole ?? authUser?.app_metadata?.role ?? null;
};

const buildSignedOutState = () => ({
  status: "signed_out",
  session: null,
  authUser: null,
  profile: null,
  role: null,
  error: null,
});

const buildSignedInState = ({ session, authUser, profile }) => ({
  status: "signed_in",
  session: session ?? null,
  authUser: authUser ?? null,
  profile: profile ?? null,
  role: resolveRole(profile, authUser, null),
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
    status: "loading",
    session: null,
    authUser: null,
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
  authSubscription: null,
  bootstrapPromise: null,
  sessionPromise: null,
  userPromise: null,
  providerCount: 0,
  guardSubscribed: false,
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

function seedAuthState({
  initialSession,
  initialUser,
  initialProfile,
  initialRole,
}) {
  if (!initialSession && !initialUser && !initialProfile && !initialRole) {
    return;
  }

  const nextState = { ...authStore.state };
  let changed = false;

  if (initialSession && !nextState.session) {
    nextState.session = initialSession;
    changed = true;
  }

  if (initialUser && !nextState.authUser) {
    nextState.authUser = initialUser;
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
    nextState.role = resolveRole(
      nextState.profile,
      nextState.authUser,
      nextState.role
    );
    nextState.status =
      nextState.session || nextState.authUser ? "signed_in" : nextState.status;
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

  if (!rateLimited && !next.session && !next.authUser) {
    void bootstrapAuth();
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

async function getSessionOnce() {
  if (!authStore.supabase) {
    return { data: { session: null }, error: new Error("Supabase unavailable") };
  }
  if (authStore.sessionPromise) {
    return authStore.sessionPromise;
  }
  authStore.sessionPromise = authStore.supabase.auth
    .getSession()
    .finally(() => {
      authStore.sessionPromise = null;
    });
  return authStore.sessionPromise;
}

async function getTrustedUser() {
  if (!authStore.supabase) {
    return { user: null, error: new Error("Supabase unavailable") };
  }
  if (!authStore.userPromise) {
    authStore.userPromise = authStore.supabase.auth
      .getUser()
      .then(({ data, error }) => ({ user: data?.user ?? null, error }))
      .finally(() => {
        authStore.userPromise = null;
      });
  }
  return authStore.userPromise;
}

async function fetchProfile(authUser) {
  if (!authStore.supabase || !authUser?.id) {
    return { profile: null, error: null };
  }
  const { data, error } = await authStore.supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();
  return { profile: data ?? null, error };
}

async function hydrateSignedIn(session) {
  const { user, error } = await getTrustedUser();
  if (error || !user) {
    updateAuthState({
      status: "signed_out",
      error: error?.message || "Unable to load user",
      session: null,
      authUser: null,
      profile: null,
      role: null,
    });
    return;
  }

  const { profile } = await fetchProfile(user);
  setAuthState(
    withGuardState(
      buildSignedInState({
        session,
        authUser: user,
        profile,
      })
    )
  );
}

async function bootstrapAuth() {
  if (authStore.bootstrapPromise) return authStore.bootstrapPromise;
  const guard = getAuthGuardState();
  if (guard.cooldownMsRemaining > 0) {
    syncAuthGuardState(guard);
    return null;
  }

  authStore.bootstrapPromise = (async () => {
    updateAuthState({ status: "loading", error: null });
    const { data, error } = await getSessionOnce();
    if (error || !data?.session) {
      updateAuthState(withGuardState(buildSignedOutState()));
      return;
    }
    await hydrateSignedIn(data.session);
  })().finally(() => {
    authStore.bootstrapPromise = null;
  });

  return authStore.bootstrapPromise;
}

function ensureAuthListener() {
  if (!authStore.supabase || authStore.authSubscription) return;
  const { data } = authStore.supabase.auth.onAuthStateChange(
    (_event, session) => {
      if (!session) {
        updateAuthState(withGuardState(buildSignedOutState()));
        return;
      }
      void hydrateSignedIn(session);
    }
  );
  authStore.authSubscription = data?.subscription || null;
}

function releaseAuthListener() {
  if (authStore.authSubscription) {
    authStore.authSubscription.unsubscribe();
    authStore.authSubscription = null;
  }
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
  initialSession = null,
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
      initialSession,
      initialUser,
      initialProfile,
      initialRole,
    });

    ensureAuthGuardSubscription();
    ensureAuthListener();

    if (!authStore.state.authUser && !authStore.state.session) {
      void bootstrapAuth();
    }

    return () => {
      mountedRef.current = false;
      authStore.providerCount = Math.max(0, authStore.providerCount - 1);
      if (authStore.providerCount === 0) {
        releaseAuthListener();
      }
    };
  }, [
    supabase,
    initialSession,
    initialUser,
    initialProfile,
    initialRole,
  ]);

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
    if (!mountedRef.current || !authStore.supabase || !authState.authUser?.id) {
      return;
    }
    const { profile, error } = await fetchProfile(authState.authUser);
    if (error || !mountedRef.current) return;
    updateAuthState({
      profile,
      role: resolveRole(profile, authState.authUser, authState.role),
    });
  }, [authState.authUser, authState.role]);

  const logout = useCallback(async () => {
    if (!authStore.supabase) {
      if (typeof window !== "undefined") {
        window.location.replace(PATHS.public.root);
      }
      return;
    }

    try {
      await authStore.supabase.auth.signOut({ scope: "local" });
    } catch {
      // Ignore and let server route clear cookies.
    } finally {
      updateAuthState(withGuardState(buildSignedOutState()));
      if (typeof window !== "undefined") {
        window.location.replace("/api/auth/logout");
      }
    }
  }, []);

  const value = useMemo(
    () => ({
      supabase: authStore.supabase,
      status: authState.status,
      session: authState.session,
      authUser: authState.authUser,
      user: authState.profile,
      profile: authState.profile,
      role: authState.role,
      error: authState.error,
      loadingUser: authState.status === "loading" || authState.rateLimited,
      rateLimited: authState.rateLimited,
      rateLimitUntil: authState.rateLimitUntil,
      rateLimitMessage: authState.rateLimitMessage,
      refreshProfile,
      logout,
    }),
    [
      authState.authUser,
      authState.error,
      authState.profile,
      authState.rateLimitMessage,
      authState.rateLimitUntil,
      authState.rateLimited,
      authState.role,
      authState.session,
      authState.status,
      logout,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
