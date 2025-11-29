"use client";

import { createBrowserClient } from "@/lib/supabaseClient";
import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [supabase] = useState(() => createBrowserClient());

  const [authUser, setAuthUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  async function loadProfile(userId) {
    if (!userId) return null;
    const { data } = await supabase.from("users").select("*").eq("id", userId).single();
    return data;
  }

  // Load initial session ONCE
  useEffect(() => {
    let active = true;

    async function load() {
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

    load();

    // Listen for login/logout — DO NOT setLoadingUser(true) again
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

  return (
    <AuthContext.Provider
        value={{
          supabase,
          authUser,
          user: appUser,
          role: appUser?.role || null,
          loadingUser,
          refreshProfile: async () => {
            if (!authUser) return;
            const { data } = await supabase
              .from("users")
              .select("*")
              .eq("id", authUser.id)
              .single();
            setAppUser(data);
          }
        }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
