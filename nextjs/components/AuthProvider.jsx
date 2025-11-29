"use client";

import { getBrowserSupabaseClient } from "@/lib/supabaseClient";
import { createContext, useContext, useEffect, useState, useRef } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const supabaseRef = useRef(null);

  if (!supabaseRef.current) {
    supabaseRef.current = getBrowserSupabaseClient();
  }

  const supabase = supabaseRef.current;

  const [authUser, setAuthUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  /* ============================================================
     SAFE PROFILE LOADER WITH RETRY (fixes blank after signup)
  ============================================================ */
  async function loadProfileWithRetry(userId) {
    if (!userId) return null;

    for (let i = 0; i < 12; i++) {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      // When the row exists → return it
      if (data) return data;

      // If Supabase returns a REAL error → stop retrying
      if (error && (error.code || error.message)) {
        console.error("Profile load error:", error);
        return null;
      }

      // Otherwise wait a bit then retry (row not created yet)
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    console.warn("Profile did not load after retries.");
    return null;
  }

  /* ============================================================
     INITIAL SESSION + PROFILE LOAD
  ============================================================ */
  useEffect(() => {
    let active = true;

    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      const user = session?.user || null;
      setAuthUser(user);

      if (user) {
        const profile = await loadProfileWithRetry(user.id);
        if (active) setAppUser(profile);
      }

      if (active) setLoadingUser(false);
    }

    init();

    /* ============================================================
       AUTH STATE LISTENER
    ============================================================ */
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const user = session?.user || null;
        setAuthUser(user);

        if (user) {
          const profile = await loadProfileWithRetry(user.id);
          setAppUser(profile);
        } else {
          setAppUser(null);
        }
      }
    );

    return () => {
      active = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, [supabase]);

  /* ============================================================
     MANUAL PROFILE REFRESH
  ============================================================ */
  async function refreshProfile() {
    if (!authUser?.id) return;
    const profile = await loadProfileWithRetry(authUser.id);
    if (profile) setAppUser(profile);
  }

  /* ============================================================
     PROVIDED CONTEXT
  ============================================================ */
  return (
    <AuthContext.Provider
      value={{
        supabase,
        authUser,
        user: appUser,
        role: appUser?.role || null,
        loadingUser,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
