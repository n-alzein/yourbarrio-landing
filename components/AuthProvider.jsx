"use client";

import { createContext, useContext, useMemo, useState, useCallback } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient";
import { PATHS } from "@/lib/auth/paths";

const AuthContext = createContext({
  supabase: null,
  session: null,
  authUser: null,
  user: null,
  role: null,
  loadingUser: false,
  refreshProfile: async () => {},
  logout: async () => {},
});

export function AuthProvider({
  children,
  initialSession = null,
  initialUser = null,
  initialProfile = null,
  initialRole = null,
}) {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [session, setSession] = useState(initialSession);
  const [authUser, setAuthUser] = useState(initialUser);
  const [profile, setProfile] = useState(initialProfile);

  const refreshProfile = useCallback(async () => {
    if (!supabase || !authUser?.id) return;
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();

    if (!error) {
      setProfile(data ?? null);
    }
  }, [authUser?.id, supabase]);

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
      setSession(null);
      setAuthUser(null);
      setProfile(null);
      if (typeof window !== "undefined") {
        window.location.replace("/api/auth/logout");
      }
    }
  }, [supabase]);

  const role = profile?.role ?? initialRole ?? null;

  const value = {
    supabase,
    session,
    authUser,
    user: profile,
    role,
    loadingUser: false,
    refreshProfile,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
