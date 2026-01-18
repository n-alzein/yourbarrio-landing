"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient";
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

function authReducer(state, action) {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, status: "loading", error: null };
    case "SIGNED_OUT":
      return buildSignedOutState();
    case "SIGNED_IN":
      return buildSignedInState(action.payload);
    case "PROFILE_REFRESHED":
      return {
        ...state,
        profile: action.profile ?? null,
        role: resolveRole(action.profile, state.authUser, null),
      };
    case "ERROR":
      return { ...state, status: "signed_out", error: action.error || "Auth error" };
    default:
      return state;
  }
}

export function AuthProvider({
  children,
  initialSession = null,
  initialUser = null,
  initialProfile = null,
  initialRole = null,
}) {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const mountedRef = useRef(true);
  const userPromiseRef = useRef(null);

  const [state, dispatch] = useReducer(authReducer, {
    status: initialSession || initialUser ? "signed_in" : "loading",
    session: initialSession,
    authUser: initialUser,
    profile: initialProfile,
    role: resolveRole(initialProfile, initialUser, initialRole),
    error: null,
  });

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (supabase || state.authUser || state.session) return;
    dispatch({ type: "SIGNED_OUT" });
  }, [state.authUser, state.session, supabase]);

  const getTrustedUser = useCallback(async () => {
    if (!supabase) {
      return { user: null, error: new Error("Supabase unavailable") };
    }
    if (!userPromiseRef.current) {
      userPromiseRef.current = supabase.auth
        .getUser()
        .then(({ data, error }) => ({ user: data?.user ?? null, error }))
        .finally(() => {
          userPromiseRef.current = null;
        });
    }
    return userPromiseRef.current;
  }, [supabase]);

  const fetchProfile = useCallback(
    async (authUser) => {
      if (!supabase || !authUser?.id) return { profile: null, error: null };
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();
      return { profile: data ?? null, error };
    },
    [supabase]
  );

  const hydrateSignedIn = useCallback(
    async (session) => {
      const { user, error } = await getTrustedUser();
      if (error || !user) {
        dispatch({ type: "ERROR", error: error?.message || "Unable to load user" });
        return;
      }
      const { profile } = await fetchProfile(user);
      if (!mountedRef.current) return;
      dispatch({
        type: "SIGNED_IN",
        payload: { session, authUser: user, profile },
      });
    },
    [fetchProfile, getTrustedUser]
  );

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;

    const shouldBootstrap = !state.authUser && !state.session;
    if (shouldBootstrap) {
      dispatch({ type: "SET_LOADING" });
    }

    const bootstrap = async () => {
      if (!shouldBootstrap) return;
      const { data, error } = await supabase.auth.getSession();
      if (!active || !mountedRef.current) return;
      if (error || !data?.session) {
        dispatch({ type: "SIGNED_OUT" });
        return;
      }
      await hydrateSignedIn(data.session);
    };

    bootstrap();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active || !mountedRef.current) return;
      if (!session) {
        dispatch({ type: "SIGNED_OUT" });
        return;
      }
      hydrateSignedIn(session);
    });

    return () => {
      active = false;
      data?.subscription?.unsubscribe();
    };
  }, [hydrateSignedIn, state.authUser, state.session, supabase]);

  const refreshProfile = useCallback(async () => {
    if (!mountedRef.current || !supabase || !state.authUser?.id) return;
    const { profile, error } = await fetchProfile(state.authUser);
    if (error || !mountedRef.current) return;
    dispatch({ type: "PROFILE_REFRESHED", profile });
  }, [fetchProfile, state.authUser, supabase]);

  const logout = useCallback(async () => {
    if (!supabase) {
      if (typeof window !== "undefined") {
        window.location.replace(PATHS.public.root);
      }
      return;
    }

    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Ignore and let server route clear cookies.
    } finally {
      dispatch({ type: "SIGNED_OUT" });
      if (typeof window !== "undefined") {
        window.location.replace("/api/auth/logout");
      }
    }
  }, [supabase]);

  const value = useMemo(
    () => ({
      supabase,
      status: state.status,
      session: state.session,
      authUser: state.authUser,
      user: state.profile,
      profile: state.profile,
      role: state.role,
      error: state.error,
      loadingUser: state.status === "loading",
      refreshProfile,
      logout,
    }),
    [
      logout,
      refreshProfile,
      state.authUser,
      state.error,
      state.profile,
      state.role,
      state.session,
      state.status,
      supabase,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
