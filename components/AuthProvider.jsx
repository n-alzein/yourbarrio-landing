/*
AUTH AUDIT REPORT
- components/AuthProvider.jsx: getSession on mount + throttled sync; single onAuthStateChange subscription.
- app/business-auth/login/page.js: signInWithPassword/signInWithOAuth; /api/auth/refresh after login (no getSession polling).
- components/modals/CustomerLoginModal.jsx and components/modals/CustomerSignupModal.jsx:
  signInWithPassword/signUp + /api/auth/refresh with session tokens.
- app/(app)/business/onboarding/page.js and app/profile/page.js: use AuthProvider state (no direct auth calls).
- lib/supabaseQuery.js: refreshAuthCookies calls getSession when runSupabaseQuery is used.
- middleware.js: auth.getUser for protected routes only (matcher narrowed to protected paths).
- Server layouts/pages (e.g. app/(app)/business/layout.js, app/(app)/customer/layout.js):
  auth.getUser on protected SSR requests.
- Runs on every navigation: middleware + protected layouts on matched protected routes.
- Suspected loops before fixes: proactive refresh interval, per-page getSession polling,
  broad middleware matcher.
*/
"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getBrowserSupabaseClient,
  getCookieName,
  resetSupabaseClient,
} from "@/lib/supabaseClient";
import { initAuthDiagnostics } from "@/lib/authDiagnostics";
import {
  initDebugNav,
  logAuthTelemetry,
  logLogout,
} from "@/lib/debugNav";
import DebugNavOverlay from "./DebugNavOverlay";
import AuthDiagBadge from "./AuthDiagBadge";

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
  const [session, setSession] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const supabaseRef = useRef(supabase);
  const sessionRef = useRef(null);
  const sessionFetchPromiseRef = useRef(null);
  const lastSessionFetchAtRef = useRef(0);
  const authUserRef = useRef(null);
  const loadingUserRef = useRef(loadingUser);
  const isMountedRef = useRef(true);
  const sessionRefreshInFlight = useRef(false);
  const lastRoleRef = useRef(null);
  const SESSION_THROTTLE_MS = 8000;

  useEffect(() => {
    supabaseRef.current = supabase;
  }, [supabase]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

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

  const setSessionState = useCallback((nextSession) => {
    sessionRef.current = nextSession;
    if (isMountedRef.current) {
      setSession(nextSession);
    }
  }, []);

  const getSessionSnapshot = useCallback(
    async (reason = "unknown") => {
      const client = getSupabaseClient();
      if (!client) return { data: { session: null }, error: new Error("no-client") };

      const now = Date.now();
      if (sessionFetchPromiseRef.current) {
        return sessionFetchPromiseRef.current;
      }

      if (
        sessionRef.current &&
        now - lastSessionFetchAtRef.current < SESSION_THROTTLE_MS
      ) {
        return { data: { session: sessionRef.current }, error: null, reason, cached: true };
      }

      sessionFetchPromiseRef.current = (async () => {
        lastSessionFetchAtRef.current = Date.now();
        const result = await client.auth.getSession();
        setSessionState(result?.data?.session ?? null);
        return result;
      })();

      try {
        return await sessionFetchPromiseRef.current;
      } finally {
        sessionFetchPromiseRef.current = null;
      }
    },
    [getSupabaseClient, setSessionState]
  );

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

  useEffect(() => {
    if (!authDiagEnabled) return;
    initAuthDiagnostics();
  }, [authDiagEnabled]);

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

  const buildFallbackProfile = (user) => {
    if (!user) return null;
    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      "";
    const role =
      user.user_metadata?.role ||
      "customer";

    return {
      id: user.id,
      email: user.email || "",
      role,
      full_name: fullName,
      business_name: "",
      profile_photo_url: user.user_metadata?.avatar_url || "",
    };
  };

  async function ensureProfile(user, existingProfile) {
    if (!user) return null;
    if (existingProfile) return existingProfile;

    const fallback = buildFallbackProfile(user);
    const client = getSupabaseClient();
    if (client && fallback) {
      try {
        const { error } = await client
          .from("users")
          .upsert(
            {
              id: fallback.id,
              email: fallback.email,
              role: fallback.role,
              full_name: fallback.full_name || "",
              profile_photo_url: fallback.profile_photo_url || "",
            },
            { onConflict: "id", ignoreDuplicates: true }
          );
        if (error) {
          console.warn("Profile upsert failed", error);
        }
      } catch (err) {
        console.warn("Profile upsert threw", err);
      }
    }

    return fallback;
  }

  /* -----------------------------------------------------------------
     SAFE RESET / CLEAR
  ----------------------------------------------------------------- */
  const finishLoading = () => {
    if (isMountedRef.current) setLoadingUser(false);
  };

  const resetState = () => {
    if (!isMountedRef.current) return;
    setSessionState(null);
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

      const sessionResult = await getSessionSnapshot("sync");
      const nextSession = sessionResult?.data?.session ?? null;
      const sessionUser = sanitizeAuthUser(nextSession?.user ?? null);

      if (sessionUser) {
        if (authUserRef.current?.id !== sessionUser.id) {
          setAuthUser(sessionUser);
        }
        const shouldLoadProfile =
          !profile || profile.id !== sessionUser.id;
        if (shouldLoadProfile) {
          const p = await loadProfile(sessionUser.id);
          if (!p?.aborted) {
            const resolvedProfile =
              p?.profile || (await ensureProfile(sessionUser, null));
            setProfile(resolvedProfile);
            await cacheGoogleAvatar(sessionUser, resolvedProfile);
          }
        }
      } else {
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
        const sessionResult = await getSessionSnapshot("init");
        const nextSession = sessionResult?.data?.session ?? null;
        const sessionUser = sanitizeAuthUser(nextSession?.user ?? null);

        if (isMountedRef.current && sessionUser) {
          setAuthUser(sessionUser);
          const p = await loadProfile(sessionUser.id, {
            signal: controller.signal,
          });
          if (isMountedRef.current && !p?.aborted) {
            const resolvedProfile =
              p?.profile || (await ensureProfile(sessionUser, null));
            setProfile(resolvedProfile);
            await cacheGoogleAvatar(sessionUser, resolvedProfile);
          }
        } else if (isMountedRef.current && !sessionUser) {
          setProfile(null);
          setAuthUser(null);
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
            setSessionState(session ?? null);
            // Skip only the synthetic initial event; handle real sign-ins immediately
            if (event === "INITIAL_SESSION") return;

            const forced = sessionStorage.getItem("forceLogout") === "1";
            if (forced) {
              sessionStorage.removeItem("forceLogout");
              // Ignore stray sign-outs, but allow real sign-ins to proceed
              if (event !== "SIGNED_IN") return;
            }

            if (event === "SIGNED_OUT" || event === "USER_DELETED") {
              setSessionState(null);
              setAuthUser(null);
              setProfile(null);
              return;
            }

            const sessionUser = sanitizeAuthUser(session?.user ?? null);
            if (sessionUser) {
              setAuthUser(sessionUser);
            }
            if (sessionUser) {
              const p = await loadProfile(sessionUser.id);
              if (!p?.aborted) {
                const resolvedProfile =
                  p?.profile || (await ensureProfile(sessionUser, null));
                setProfile(resolvedProfile);
                await cacheGoogleAvatar(sessionUser, resolvedProfile);
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
  }, [supabase, getSessionSnapshot, setSessionState]);

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
        const sessionResult = await getSessionSnapshot("storage");
        const nextSession = sessionResult?.data?.session ?? null;
        const sessionUser = sanitizeAuthUser(nextSession?.user ?? null);

        setAuthUser(sessionUser);

        if (sessionUser) {
          const p = await loadProfile(sessionUser.id);
          if (!p?.aborted) {
            const resolvedProfile =
              p?.profile || (await ensureProfile(sessionUser, null));
            setProfile(resolvedProfile);
            await cacheGoogleAvatar(sessionUser, resolvedProfile);
          }
        } else {
          setProfile(null);
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
    if (p && !p.aborted) {
      const resolvedProfile = p?.profile || (await ensureProfile(authUser, null));
      setProfile(resolvedProfile);
    }
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
    try {
      sessionStorage.setItem("forceLogout", "1");
    } catch (err) {
      console.warn("Could not set forceLogout flag", err);
    }

    const client = supabaseRef.current || getBrowserSupabaseClient();

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

    setSessionState(null);
    setAuthUser(null);
    setProfile(null);
    setLoadingUser(false);

    if (typeof window !== "undefined") {
      window.location.replace("/api/auth/logout");
      return;
    }

    const target = lastRole === "business" ? "/business" : "/";
    router.replace(target);
    router.refresh();
  }

  return (
    <AuthContext.Provider
      value={{
        supabase,
        session,
        authUser,
        user: profile,
        role: profile?.role ?? null,
        loadingUser,
        loading: loadingUser,
        refreshProfile,
        logout,
      }}
    >
      {children}
      <DebugNavOverlay />
      <AuthDiagBadge />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
