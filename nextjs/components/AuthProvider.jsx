"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  /* -------------------------------------------------------------
     STABLE SUPABASE CLIENT
  ------------------------------------------------------------- */
  const supabaseRef = useRef(null);
  if (!supabaseRef.current) {
    supabaseRef.current = getBrowserSupabaseClient();
  }
  const supabase = supabaseRef.current;

  /* -------------------------------------------------------------
     STATE
  ------------------------------------------------------------- */
  const [authUser, setAuthUser] = useState(null);   // auth.users
  const [profile, setProfile] = useState(null);      // public.users
  const [loadingUser, setLoadingUser] = useState(true);

  /* -------------------------------------------------------------
     LOAD PROFILE ROW
  ------------------------------------------------------------- */
  async function loadProfile(userId) {
    if (!userId) return null;

    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    return data || null;
  }

  /* -------------------------------------------------------------
     INITIAL SESSION LOAD
  ------------------------------------------------------------- */
  useEffect(() => {
    let mounted = true;

    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user ?? null;
      if (!mounted) return;

      setAuthUser(user);

      if (user) {
        const p = await loadProfile(user.id);
        if (mounted) setProfile(p);
      }

      setLoadingUser(false);
    }

    init();

    /* -------------------------------------------------------------
       AUTH LISTENER — FIXED TO IGNORE LOGOUT REDIRECTS
    ------------------------------------------------------------- */
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Prevent unwanted redirects after logout()
        if (
          typeof window !== "undefined" &&
          sessionStorage.getItem("forceLogout") === "1"
        ) {
          sessionStorage.removeItem("forceLogout");
          return;
        }

        const user = session?.user ?? null;
        setAuthUser(user);

        if (user) {
          const p = await loadProfile(user.id);
          setProfile(p);
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  /* -------------------------------------------------------------
     REFRESH PROFILE MANUALLY
  ------------------------------------------------------------- */
  async function refreshProfile() {
    if (!authUser?.id) return;
    const p = await loadProfile(authUser.id);
    if (p) setProfile(p);
  }

  /* -------------------------------------------------------------
     LOGOUT — NO MORE /login REDIRECT
  ------------------------------------------------------------- */
  async function logout() {
    // Prevent onAuthStateChange from redirecting
    sessionStorage.setItem("forceLogout", "1");

    await supabase.auth.signOut();
    setAuthUser(null);
    setProfile(null);

    // ALWAYS send to home
    window.location.replace("/");
  }

  /* -------------------------------------------------------------
     PROVIDER
  ------------------------------------------------------------- */
  return (
    <AuthContext.Provider
      value={{
        supabase,
        authUser,
        user: profile,
        role: profile?.role ?? null,
        loadingUser,
        refreshProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/* -------------------------------------------------------------
   HOOK
------------------------------------------------------------- */
export function useAuth() {
  return useContext(AuthContext);
}
