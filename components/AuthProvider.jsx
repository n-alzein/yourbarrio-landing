"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getBrowserSupabaseClient,
  getCookieName,
} from "@/lib/supabaseClient";
import {
  initDebugNav,
  logAuthTelemetry,
  logLogout,
} from "@/lib/debugNav";
import DebugNavOverlay from "./DebugNavOverlay";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const router = useRouter();
  const authDiagEnabled = process.env.NEXT_PUBLIC_AUTH_DIAG === "1";
  const authDiagPrevRef = useRef({
    loadingUser: null,
    authUserId: null,
  });

  const authDiagLog = (event, payload = {}) => {
    if (!authDiagEnabled || typeof window === "undefined") return;
    const timestamp = new Date().toISOString();
    const pathname = window.location.pathname;
    // eslint-disable-next-line no-console
    console.log("[AUTH_DIAG]", { timestamp, pathname, event, ...payload });
  };

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
  const sessionRefreshInFlight = useRef(false);
  const lastRoleRef = useRef(null);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /* -----------------------------------------------------------------
     DEBUG NAV INIT
  ----------------------------------------------------------------- */
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      initDebugNav();
    }
  }, []);

  /* -----------------------------------------------------------------
     AUTH TELEMETRY (debug only)
  ----------------------------------------------------------------- */
  useEffect(() => {
    logAuthTelemetry({
      loadingUser,
      authUserId: authUser?.id ?? null,
      role: profile?.role ?? null,
      hasProfile: Boolean(profile),
    });

    if (!authDiagEnabled) return;
    const prev = authDiagPrevRef.current;
    const next = {
      loadingUser,
      authUserId: authUser?.id ?? null,
    };
    if (prev.loadingUser !== next.loadingUser) {
      authDiagLog("loadingUser change", {
        prev: prev.loadingUser,
        next: next.loadingUser,
      });
    }
    if (prev.authUserId !== next.authUserId) {
      authDiagLog("authUser change", {
        prev: prev.authUserId,
        next: next.authUserId,
      });
    }
    authDiagPrevRef.current = next;
  }, [loadingUser, authUser?.id, profile?.role, profile]);

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
     VERIFIED USER FETCH (avoid untrusted session user)
  ----------------------------------------------------------------- */
  async function getCachedUser() {
    if (!supabase) return null;

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error) throw error;
      return sanitizeAuthUser(session?.user ?? null);
    } catch (err) {
      console.warn("Supabase getSession failed while reading cache", err);
      return null;
    }
  }

  async function getVerifiedUser() {
    if (!supabase) return null;

    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return sanitizeAuthUser(data?.user ?? null);
    } catch (err) {
      console.warn("Supabase getUser failed, falling back to session cache", err);
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error) throw error;
        return sanitizeAuthUser(session?.user ?? null);
      } catch (sessionErr) {
        console.error("Supabase getSession failed after getUser", sessionErr);
        return null;
      }
    }
  }

  /* -----------------------------------------------------------------
     LOAD PROFILE
  ----------------------------------------------------------------- */
  async function loadProfile(userId, { signal } = {}) {
    if (!userId || signal?.aborted) return { profile: null, aborted: true };

    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (signal?.aborted) return { profile: null, aborted: true };
      if (error) {
        console.warn("Profile load failed", error);
        return { profile: null, error };
      }
      return { profile: data ?? null, error: null };
    } catch (err) {
      if (signal?.aborted) return { profile: null, aborted: true };
      console.warn("Profile load threw", err);
      return { profile: null, error: err };
    }
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
     RE-VALIDATE SESSION (tab focus / returning from background)
  ----------------------------------------------------------------- */
  const syncSession = async () => {
    if (!supabase || sessionRefreshInFlight.current) return;
    sessionRefreshInFlight.current = true;

    try {
      if (!isMountedRef.current) return;

      const user = await getVerifiedUser();
      setAuthUser(user);

      if (user) {
        const p = await loadProfile(user.id);
        if (!p?.aborted && !p?.error) {
          setProfile(p.profile);
          await cacheGoogleAvatar(user, p.profile);
        }
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error("Supabase session sync failed", err);
      await clearBrokenSession();
    } finally {
      sessionRefreshInFlight.current = false;
      finishLoading();
    }
  };

  /* -----------------------------------------------------------------
     INITIAL SESSION LOAD
  ----------------------------------------------------------------- */
  useEffect(() => {
    const controller = new AbortController();

    async function init() {
      if (!supabase) {
        finishLoading();
        return;
      }

      try {
        const cachedUser = await getCachedUser();
        if (isMountedRef.current && cachedUser) {
          setAuthUser(cachedUser);
          const p = await loadProfile(cachedUser.id, {
            signal: controller.signal,
          });
          if (isMountedRef.current && !p?.aborted && !p?.error) {
            setProfile(p.profile);
            await cacheGoogleAvatar(cachedUser, p.profile);
          }
        }

        if (!isMountedRef.current) return;

        const user = await getVerifiedUser();
        if (cachedUser?.id !== user?.id) {
          setAuthUser(user);
          if (user) {
            const p = await loadProfile(user.id, { signal: controller.signal });
            if (isMountedRef.current && !p?.aborted && !p?.error) {
              setProfile(p.profile);
              await cacheGoogleAvatar(user, p.profile);
            }
          } else {
            setProfile(null);
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
            authDiagLog("onAuthStateChange", {
              event,
              hasSession: Boolean(session),
              sessionUserId: null,
            });
            // Skip only the synthetic initial event; handle real sign-ins immediately
            if (event === "INITIAL_SESSION") return;

            const forced = sessionStorage.getItem("forceLogout") === "1";
            if (forced) {
              sessionStorage.removeItem("forceLogout");
              // Ignore stray sign-outs, but allow real sign-ins to proceed
              if (event !== "SIGNED_IN") return;
            }

            if (event === "SIGNED_OUT" || event === "USER_DELETED") {
              setAuthUser(null);
              setProfile(null);
              return;
            }

            const sessionUser = sanitizeAuthUser(session?.user ?? null);
            if (sessionUser) {
              setAuthUser(sessionUser);
            }

            const user = await getVerifiedUser();
            if (sessionUser?.id !== user?.id) {
              setAuthUser(user);
            }

            if (user) {
              const p = await loadProfile(user.id);
              if (!p?.aborted && !p?.error) {
                setProfile(p.profile);

                await cacheGoogleAvatar(user, p.profile);
              }
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
      controller.abort();
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  /* -----------------------------------------------------------------
     KEEP SESSION FRESH AFTER LONG IDLE PERIODS
  ----------------------------------------------------------------- */
  useEffect(() => {
    if (!supabase) return;

    const handleVisibility = () => {
      authDiagLog("visibilitychange", {
        visibilityState: document.visibilityState,
      });
      if (document.hidden) return;
      syncSession();
    };

    const handleFocus = () => syncSession();
    const handlePageShow = (event) => {
      authDiagLog("pageshow", { persisted: event?.persisted ?? null });
      syncSession();
    };
    const handlePageHide = (event) => {
      authDiagLog("pagehide", { persisted: event?.persisted ?? null });
    };

    window.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("pagehide", handlePageHide);
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
        const user = await getVerifiedUser();
        setAuthUser(user);

        if (user) {
          const p = await loadProfile(user.id);
          if (!p?.aborted && !p?.error) {
            setProfile(p.profile);
            await cacheGoogleAvatar(user, p.profile);
          }
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
    if (p && !p.error && !p.aborted) setProfile(p.profile);
  }

  useEffect(() => {
    const role =
      profile?.role ||
      authUser?.user_metadata?.role ||
      authUser?.role ||
      null;
    if (role) lastRoleRef.current = role;
  }, [profile?.role, authUser?.user_metadata?.role, authUser?.role]);

  /* -----------------------------------------------------------------
     LOGOUT
  ----------------------------------------------------------------- */
  async function logout() {
    logLogout("logout invoked");
    const lastRole =
      lastRoleRef.current ||
      profile?.role ||
      authUser?.user_metadata?.role ||
      null;
    const currentPath =
      typeof window !== "undefined" ? window.location.pathname : "";
    try {
      sessionStorage.setItem("forceLogout", "1");
    } catch (err) {
      console.warn("Could not set forceLogout flag", err);
    }

    const client = supabaseRef.current || getBrowserSupabaseClient();

    const clearCookies = () => {
      if (typeof document === "undefined") return;
      const cookieName = getCookieName();

      const host = window.location.hostname;
      const domains = [host];
      if (host && !host.startsWith("localhost") && !host.startsWith("127.")) {
        domains.push(`.${host}`);
      }

      const cookieNames = document.cookie
        .split(";")
        .map((entry) => entry.split("=")[0].trim())
        .filter((name) => {
          if (!name) return false;
          if (name.startsWith("sb-")) return true;
          if (cookieName && name.startsWith(cookieName)) return true;
          return false;
        });

      if (cookieName) cookieNames.push(cookieName);
      const uniqueNames = Array.from(new Set(cookieNames));

      // Clear without domain (works for localhost)
      uniqueNames.forEach((name) => {
        try {
          document.cookie = `${name}=; path=/; max-age=0; sameSite=lax`;
        } catch (err) {
          console.warn("Could not clear auth cookie (no domain)", name, err);
        }
      });

      domains.forEach((domain) => {
        uniqueNames.forEach((name) => {
          try {
            document.cookie = `${name}=; path=/; domain=${domain}; max-age=0; sameSite=lax`;
          } catch (err) {
            console.warn("Could not clear auth cookie for domain", domain, name, err);
          }
        });
      });
    };

    const signOutTasks = [];

    if (client) {
      // Run local + global signouts before redirecting
      signOutTasks.push(
        {
          label: "signOut:local",
          task: client.auth.signOut(),
        }
      );
      signOutTasks.push(
        {
          label: "signOut:global",
          task: client.auth.signOut({ scope: "global" }),
        }
      );
    }

    const fetchController = new AbortController();
    const fetchTimeoutId = setTimeout(() => fetchController.abort(), 6000);
    const logoutFetch = fetch("/api/logout", {
      method: "POST",
      credentials: "include",
      signal: fetchController.signal,
    }).finally(() => clearTimeout(fetchTimeoutId));

    signOutTasks.push({
      label: "api/logout",
      task: logoutFetch,
    });

    const timeoutMs = 6000;
    const runWithTimeout = ({ label, task }) => {
      let timeoutId;
      const timeout = new Promise((resolve) => {
        timeoutId = setTimeout(() => {
          console.warn(`Logout task timed out (${label})`);
          resolve();
        }, timeoutMs);
      });

      const safeTask = Promise.resolve(task)
        .catch((err) => console.error("Logout task failed", label, err))
        .finally(() => clearTimeout(timeoutId));

      return Promise.race([safeTask, timeout]);
    };

    await Promise.allSettled(signOutTasks.map(runWithTimeout));

    clearCookies();

    setAuthUser(null);
    setProfile(null);
    setLoadingUser(false);

    const target =
      lastRole === "business" || currentPath.startsWith("/business")
        ? "/business"
        : "/";

    if (typeof window !== "undefined") {
      window.location.assign(target);
    } else {
      router.replace(target);
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
      <DebugNavOverlay />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
