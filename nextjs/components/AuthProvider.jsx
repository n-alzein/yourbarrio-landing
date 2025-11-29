"use client";

import { createBrowserClient } from "@/lib/supabaseClient";
import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [supabase] = useState(() => createBrowserClient());

  const [authUser, setAuthUser] = useState(null);   // session user
  const [appUser, setAppUser] = useState(null);     // row from "users"
  const [loadingUser, setLoadingUser] = useState(true);

  // Load profile from Supabase
  async function loadProfile(userId) {
    if (!userId) return null;

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Profile load error:", error);
      return null;
    }

    return data;
  }

  // Initial load
  useEffect(() => {
    let active = true;

    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      const authU = session?.user || null;
      setAuthUser(authU);

      if (authU) {
        const profile = await loadProfile(authU.id);
        if (active) setAppUser(profile);
      }

      if (active) setLoadingUser(false);
    }

    init();

    // Listen for login/logout
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const authU = session?.user || null;
        setAuthUser(authU);

        if (authU) {
          const profile = await loadProfile(authU.id);
          setAppUser(profile);
        } else {
          setAppUser(null);
        }
      }
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  // SUPER-STABLE refreshProfile (never hangs)
  async function refreshProfile() {
    if (!authUser?.id) return;

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (error) {
      console.warn("refreshProfile failed:", error);
      return;
    }

    setAppUser(data);
  }

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
