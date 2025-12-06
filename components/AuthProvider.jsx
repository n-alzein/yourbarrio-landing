"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const router = useRouter();

  /* -----------------------------------------------------------------
     STABLE SUPABASE CLIENT
  ----------------------------------------------------------------- */
  const supabaseRef = useRef(null);
  if (!supabaseRef.current) {
    supabaseRef.current = getBrowserSupabaseClient();
  }
  const supabase = supabaseRef.current;

  /* -----------------------------------------------------------------
     STATE
  ----------------------------------------------------------------- */
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  /* -----------------------------------------------------------------
     FIX 429 ERROR — SANITIZE GOOGLE IDENTITIES
  ----------------------------------------------------------------- */
  function sanitizeAuthUser(user) {
    if (!user) return null;

    const clean = { ...user };

    // Remove the signed, expiring identity picture URLs Google returns
    if (clean.identities) {
      clean.identities = clean.identities.map((id) => {
        const newId = { ...id };
        if (newId.identity_data?.picture) {
          newId.identity_data.picture = null; // prevent browser from fetching
        }
        return newId;
      });
    }

    return clean;
  }

  /* -----------------------------------------------------------------
     SAFE GOOGLE AVATAR HANDLING (no more 429 errors)
  ----------------------------------------------------------------- */

  function sanitizeGoogleUrl(url) {
    if (!url) return null;

    const [base] = url.split("=");
    return base;
  }

  async function cacheGoogleAvatar(user, existingProfile) {
    const avatarUrl = user?.user_metadata?.avatar_url;
    if (!avatarUrl) return;

    if (
      existingProfile?.profile_photo_url &&
      !existingProfile.profile_photo_url.includes("googleusercontent")
    ) {
      return; // Already cached, safe stored version
    }

    const cleaned = sanitizeGoogleUrl(avatarUrl);
    if (!cleaned) return;

    await supabase
      .from("users")
      .update({ profile_photo_url: cleaned })
      .eq("id", user.id);

    setProfile((prev) => ({
      ...prev,
      profile_photo_url: cleaned,
    }));
  }

  /* -----------------------------------------------------------------
     LOAD PROFILE
  ----------------------------------------------------------------- */
  async function loadProfile(userId) {
    if (!userId) return null;

    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    return data ?? null;
  }

  /* -----------------------------------------------------------------
     INITIAL SESSION LOAD
  ----------------------------------------------------------------- */
  useEffect(() => {
    let mounted = true;
    let ignoreFirstAuth = true;

    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const rawUser = session?.user ?? null;
      if (!mounted) return;

      const user = sanitizeAuthUser(rawUser);
      setAuthUser(user);

      if (user) {
        const p = await loadProfile(user.id);
        if (mounted) {
          setProfile(p);

          await cacheGoogleAvatar(user, p);
        }
      }

      setLoadingUser(false);
    }

    init();

    /* -----------------------------------------------------------------
       AUTH LISTENER
    ----------------------------------------------------------------- */
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (ignoreFirstAuth) {
          ignoreFirstAuth = false;
          return;
        }

        if (sessionStorage.getItem("forceLogout") === "1") {
          sessionStorage.removeItem("forceLogout");
          return;
        }

        const rawUser = session?.user ?? null;
        const user = sanitizeAuthUser(rawUser);

        setAuthUser(user);

        if (user) {
          const p = await loadProfile(user.id);
          setProfile(p);

          await cacheGoogleAvatar(user, p);
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

  /* -----------------------------------------------------------------
     REFRESH PROFILE
  ----------------------------------------------------------------- */
  async function refreshProfile() {
    if (!authUser?.id) return;
    const p = await loadProfile(authUser.id);
    if (p) setProfile(p);
  }

  /* -----------------------------------------------------------------
     LOGOUT
  ----------------------------------------------------------------- */
  async function logout() {
    sessionStorage.setItem("forceLogout", "1");

    await supabase.auth.signOut();

    await new Promise((r) => setTimeout(r, 120));

    setAuthUser(null);
    setProfile(null);

    router.replace("/");
  }

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

export function useAuth() {
  return useContext(AuthContext);
}
