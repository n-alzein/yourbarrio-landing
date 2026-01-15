"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getBrowserSupabaseClient,
  getCookieName,
  resetSupabaseClient,
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
     STATE (declare all state first)
  ----------------------------------------------------------------- */
  const [supabase, setSupabase] = useState(() => getBrowserSupabaseClient());
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const supabaseRef = useRef(supabase);
  const authUserRef = useRef(null);
  const loadingUserRef = useRef(loadingUser);
  const sessionRefreshTimerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const isMountedRef = useRef(true);
  const sessionRefreshInFlight = useRef(false);
  const lastRoleRef = useRef(null);

  useEffect(() => {
    supabaseRef.current = supabase;
  }, [supabase]);

  useEffect(() => {
    authUserRef.current = authUser;
  }, [authUser]);

  useEffect(() => {
    loadingUserRef.current = loadingUser;
  }, [loadingUser]);

  const getSupabaseClient = useCallback(() => supabaseRef.current ?? supabase, [supabase]);

  const reinitSupabaseClient = useCallback(() => {
    resetSupabaseClient();
    const client = getBrowserSupabaseClient();
    if (client && client !== supabaseRef.current) {
      supabaseRef.current = client;
      setSupabase(client);
    }
    return client;
  }, []);

  // Track user activity to know when to refresh proactively
  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    // Track user interactions
    window.addEventListener("mousemove", updateActivity, { passive: true });
    window.addEventListener("keydown", updateActivity, { passive: true });
    window.addEventListener("click", updateActivity, { passive: true });
    window.addEventListener("scroll", updateActivity, { passive: true });

    return () => {
      window.removeEventListener("mousemove", updateActivity);
      window.removeEventListener("keydown", updateActivity);
      window.removeEventListener("click", updateActivity);
      window.removeEventListener("scroll", updateActivity);
    };
  }, []);

  // Proactive session refresh (like Amazon/Walmart)
  // Refreshes session every 50 minutes (tokens typically last 60 minutes)
  const startProactiveRefresh = useCallback(() => {
    if (sessionRefreshTimerRef.current) {
      clearInterval(sessionRefreshTimerRef.current);
    }

    sessionRefreshTimerRef.current = setInterval(async () => {
      // Only refresh if user has been active in the last 10 minutes
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      const tenMinutes = 10 * 60 * 1000;

      if (timeSinceActivity < tenMinutes && authUserRef.current) {
        console.log("AuthProvider: Proactively refreshing session");
        try {
          const { error } = await supabaseRef.current.auth.refreshSession();
          if (error) {
            console.error("AuthProvider: Proactive refresh failed", error);
          } else {
            console.log("AuthProvider: Session refreshed proactively");
          }
        } catch (err) {
          console.error("AuthProvider: Proactive refresh error", err);
        }
      }
    }, 50 * 60 * 1000); // 50 minutes
  }, []); // Uses refs for current values - no dependencies needed

  // Stop proactive refresh on unmount
  useEffect(() => {
    return () => {
      if (sessionRefreshTimerRef.current) {
        clearInterval(sessionRefreshTimerRef.current);
      }
    };
  }, []);

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
    const client = getSupabaseClient();
    if (!client) return;
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

    await client
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
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      const {
        data: { session },
        error,
      } = await client.auth.getSession();
      if (error) throw error;
      return sanitizeAuthUser(session?.user ?? null);
    } catch (err) {
      console.warn("Supabase getSession failed while reading cache", err);
      return null;
    }
  }

  async function getVerifiedUser() {
    const client = getSupabaseClient();
    if (!client) return null;

    const resolveFallbackUser = async () => {
      const cached = authUserRef.current || (await getCachedUser());
      if (!cached) return null;
      console.log("AuthProvider: Returning cached user while handling error");
      return cached;
    };

    const refreshSessionSafe = async () => {
      try {
        const timeoutMs = 3500;
        const { data, error } = await Promise.race([
          client.auth.refreshSession(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("refreshSession timeout")), timeoutMs)
          ),
        ]);
        if (error) return { ok: false, error };
        return { ok: true, session: data?.session ?? null };
      } catch (err) {
        return { ok: false, error: err };
      }
    };

    try {
      // No timeout - let Supabase SDK handle retries naturally
      // This is how Amazon/Walmart do it - trust the SDK's built-in retry logic
      const { data, error } = await client.auth.getUser();

      if (error) {
        console.warn("AuthProvider: getUser error", error);

        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          return await resolveFallbackUser();
        }

        const refreshResult = await refreshSessionSafe();
        if (!refreshResult.ok) {
          console.warn("AuthProvider: refreshSession failed", refreshResult.error);
          await clearBrokenSession();
          return null;
        }

        const { data: refreshedData, error: refreshedError } =
          await client.auth.getUser();
        if (refreshedError) {
          console.warn("AuthProvider: getUser after refresh failed", refreshedError);
          await clearBrokenSession();
          return null;
        }

        return sanitizeAuthUser(refreshedData?.user ?? null);
      }

      return sanitizeAuthUser(data?.user ?? null);
    } catch (err) {
      console.error("AuthProvider: getUser exception", err);

      // Return cached user if available (Amazon pattern - never disrupt user)
      const cached = authUserRef.current || (await getCachedUser());
      if (cached) {
        console.log("AuthProvider: Exception occurred, returning cached user");
        return cached;
      }

      return null;
    }
  }

  /* -----------------------------------------------------------------
     LOAD PROFILE
  ----------------------------------------------------------------- */
  async function loadProfile(userId, { signal } = {}) {
    const client = getSupabaseClient();
    if (!userId || signal?.aborted || !client) {
      return { profile: null, aborted: true };
    }

    try {
      const { data, error } = await client
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
    const clearAuthCookies = () => {
      if (typeof document === "undefined") return;
      const cookieName = getCookieName();
      const host = window.location.hostname;
      const domains = [host];
      if (host && !host.startsWith("localhost") && !host.startsWith("127.")) {
        domains.push(`.${host}`);
        if (host.startsWith("www.")) {
          const root = host.slice(4);
          if (root) {
            domains.push(root);
            domains.push(`.${root}`);
          }
        }
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

      uniqueNames.forEach((name) => {
        try {
          document.cookie = `${name}=; path=/; max-age=0; sameSite=lax`;
        } catch (err) {
          console.warn("Could not clear auth cookie (no domain)", name, err);
        }
      });

      const uniqueDomains = Array.from(new Set(domains.filter(Boolean)));
      uniqueDomains.forEach((domain) => {
        uniqueNames.forEach((name) => {
          try {
            document.cookie = `${name}=; path=/; domain=${domain}; max-age=0; sameSite=lax`;
          } catch (err) {
            console.warn("Could not clear auth cookie for domain", domain, name, err);
          }
        });
      });
    };

    const clearAuthStorage = () => {
      if (typeof localStorage === "undefined") return;
      try {
        Object.keys(localStorage)
          .filter((key) => key.startsWith("sb-"))
          .forEach((key) => localStorage.removeItem(key));
      } catch (err) {
        console.warn("Could not clear auth storage", err);
      }
    };

    try {
      await supabase?.auth?.signOut();
    } catch (err) {
      console.warn("Supabase signOut failed while clearing session", err);
    }
    clearAuthCookies();
    clearAuthStorage();
    resetState();
  };

  /* -----------------------------------------------------------------
     RE-VALIDATE SESSION (tab focus / returning from background)
  ----------------------------------------------------------------- */
  const syncSession = async () => {
    if (sessionRefreshInFlight.current) return;
    sessionRefreshInFlight.current = true;
    let shouldBlock = false;

    try {
      if (!isMountedRef.current) return;

      reinitSupabaseClient();
      shouldBlock = !authUserRef.current && !loadingUserRef.current;
      if (shouldBlock) setLoadingUser(true);

      const cachedUser = (await getCachedUser()) ?? authUserRef.current;
      if (cachedUser) {
        setAuthUser(cachedUser);
        const p = await loadProfile(cachedUser.id);
        if (!p?.aborted && !p?.error) {
          setProfile(p.profile);
          await cacheGoogleAvatar(cachedUser, p.profile);
        }
      }

      if (!isMountedRef.current) return;

      const user = await getVerifiedUser();
      if (user && user.id !== cachedUser?.id) {
        setAuthUser(user);
        const p = await loadProfile(user.id);
        if (!p?.aborted && !p?.error) {
          setProfile(p.profile);
          await cacheGoogleAvatar(user, p.profile);
        }
      } else if (!user && !cachedUser) {
        setAuthUser(null);
        setProfile(null);
      }
    } catch (err) {
      console.error("Supabase session sync failed", err);
      await clearBrokenSession();
    } finally {
      sessionRefreshInFlight.current = false;
      if (shouldBlock || (loadingUserRef.current && authUserRef.current)) {
        finishLoading();
      }
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
        if (user && cachedUser?.id !== user?.id) {
          setAuthUser(user);
          const p = await loadProfile(user.id, { signal: controller.signal });
          if (isMountedRef.current && !p?.aborted && !p?.error) {
            setProfile(p.profile);
            await cacheGoogleAvatar(user, p.profile);
          }
        } else if (!user && !cachedUser) {
          setProfile(null);
          setAuthUser(null);
        }

        // Start proactive session refresh if user is logged in
        if (user || cachedUser) {
          console.log("AuthProvider: Starting proactive session refresh on init");
          startProactiveRefresh();
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
            const resolvedUser = user || sessionUser;

            if (user && sessionUser?.id !== user?.id) {
              setAuthUser(user);
            }

            if (resolvedUser) {
              const p = await loadProfile(resolvedUser.id);
              if (!p?.aborted && !p?.error) {
                setProfile(p.profile);

                await cacheGoogleAvatar(resolvedUser, p.profile);
              }

              // Start proactive session refresh when user signs in
              if (event === "SIGNED_IN") {
                console.log("AuthProvider: Starting proactive session refresh");
                startProactiveRefresh();
              }
            } else {
              setProfile(null);
              setAuthUser(null);
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
  }, [supabase, startProactiveRefresh]);

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
        if (host.startsWith("www.")) {
          const root = host.slice(4);
          if (root) {
            domains.push(root);
            domains.push(`.${root}`);
          }
        }
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

      const uniqueDomains = Array.from(new Set(domains.filter(Boolean)));
      uniqueDomains.forEach((domain) => {
        uniqueNames.forEach((name) => {
          try {
            document.cookie = `${name}=; path=/; domain=${domain}; max-age=0; sameSite=lax`;
          } catch (err) {
            console.warn("Could not clear auth cookie for domain", domain, name, err);
          }
        });
      });
    };

    const runWithTimeout = (label, task, timeoutMs) => {
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

    if (client) {
      // Make logout feel instant: await only a quick local signout.
      await runWithTimeout("signOut:local", client.auth.signOut({ scope: "local" }), 1200);

      // Best-effort global signout in background.
      runWithTimeout("signOut:global", client.auth.signOut({ scope: "global" }), 4000);
    }

    const fetchController = new AbortController();
    const fetchTimeoutId = setTimeout(() => fetchController.abort(), 4000);
    fetch("/api/logout", {
      method: "POST",
      credentials: "include",
      keepalive: true,
      signal: fetchController.signal,
    })
      .catch((err) => console.error("Logout task failed", "api/logout", err))
      .finally(() => clearTimeout(fetchTimeoutId));

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
