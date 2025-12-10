"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getBrowserSupabaseClient,
  getCookieName,
} from "@/lib/supabaseClient";

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
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
     SAFE RESET / CLEAR
  ----------------------------------------------------------------- */
  const finishLoading = () => {
    if (isMountedRef.current) setLoadingUser(false);
  };

  const resetState = () => {
    if (!isMountedRef.current) return;
    setAuthUser(null);
    setProfile(null);
  };

  const clearBrokenSession = async () => {
    try {
      await supabase?.auth?.signOut();
    } catch (err) {
      console.warn("Supabase signOut failed while clearing session", err);
    }
    resetState();
  };

  /* -----------------------------------------------------------------
     INITIAL SESSION LOAD
  ----------------------------------------------------------------- */
  useEffect(() => {
    async function init() {
      if (!supabase) {
        finishLoading();
        return;
      }

      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error) throw error;

        const rawUser = session?.user ?? null;
        if (!isMountedRef.current) return;

        const user = sanitizeAuthUser(rawUser);
        setAuthUser(user);

        if (user) {
          const p = await loadProfile(user.id);
          if (isMountedRef.current) {
            setProfile(p);

            await cacheGoogleAvatar(user, p);
          }
        }
      } catch (err) {
        console.error("Auth init failed — clearing stale session", err);
        await clearBrokenSession();
      } finally {
        finishLoading();
      }
    }

    init();

    /* -----------------------------------------------------------------
       AUTH LISTENER
    ----------------------------------------------------------------- */
    const { data: listener } = supabase
      ? supabase.auth.onAuthStateChange(async (event, session) => {
          try {
            // Skip only the synthetic initial event; handle real sign-ins immediately
            if (event === "INITIAL_SESSION") return;

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
          } catch (err) {
            console.error("Auth listener failed — clearing session", err);
            await clearBrokenSession();
            finishLoading();
          }
        })
      : { subscription: { unsubscribe: () => {} } };

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  /* -----------------------------------------------------------------
     HANDLE CROSS-TAB LOGIN (popup broadcasts business_auth_success)
  ----------------------------------------------------------------- */
  useEffect(() => {
    async function handleStorage(event) {
      if (event.key !== "business_auth_success") return;
      if (!supabase) {
        finishLoading();
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const rawUser = session?.user ?? null;
        const user = sanitizeAuthUser(rawUser);
        setAuthUser(user);

        if (user) {
          const p = await loadProfile(user.id);
          setProfile(p);
          await cacheGoogleAvatar(user, p);
        }
      } catch (err) {
        console.error("Storage auth sync failed", err);
        await clearBrokenSession();
      }

      finishLoading();
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
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
    try {
      sessionStorage.setItem("forceLogout", "1");
    } catch (err) {
      console.warn("Could not set forceLogout flag", err);
    }

    const client = supabaseRef.current || getBrowserSupabaseClient();

    const clearCookies = () => {
      if (typeof document === "undefined") return;
      const cookieName = getCookieName();
      if (!cookieName) return;

      const host = window.location.hostname;
      const domains = [host];
      if (host && !host.startsWith("localhost") && !host.startsWith("127.")) {
        domains.push(`.${host}`);
      }

      // Clear without domain (works for localhost)
      try {
        document.cookie = `${cookieName}=; path=/; max-age=0; sameSite=lax`;
      } catch (err) {
        console.warn("Could not clear auth cookie (no domain)", err);
      }

      domains.forEach((domain) => {
        try {
          document.cookie = `${cookieName}=; path=/; domain=${domain}; max-age=0; sameSite=lax`;
        } catch (err) {
          console.warn("Could not clear auth cookie for domain", domain, err);
        }
      });
    };

    const backgroundTasks = [];

    if (client) {
      // Kick off local + global signouts; don't block UI on these calls
      backgroundTasks.push(
        client
          .auth
          .signOut()
          .catch((err) => console.error("Supabase local signOut error", err))
      );
      backgroundTasks.push(
        client
          .auth
          .signOut({ scope: "global" })
          .catch((err) => console.error("Supabase global signOut error", err))
      );
    }

    backgroundTasks.push(
      fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      }).catch((err) => console.error("Server logout call failed", err))
    );

    clearCookies();

    setAuthUser(null);
    setProfile(null);
    setLoadingUser(false);

    if (typeof window !== "undefined") {
      window.location.assign("/");
    } else {
      router.replace("/");
      router.refresh();
    }
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
