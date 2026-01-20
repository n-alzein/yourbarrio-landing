"use client";

import { Suspense } from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getCookieName } from "@/lib/supabase/browser";
import { PATHS } from "@/lib/auth/paths";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

function BusinessLoginInner() {
  const {
    supabase,
    beginAuthAttempt,
    endAuthAttempt,
    authAttemptId,
    authStatus,
    user,
    role,
  } = useAuth();
  const searchParams = useSearchParams();
  const isPopup = searchParams?.get("popup") === "1";
  const authDiagEnabled = process.env.NEXT_PUBLIC_AUTH_DIAG === "1";

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const redirectingRef = useRef(false);
  const mountedRef = useRef(false);
  const pendingRef = useRef(false);
  const attemptRef = useRef(0);
  const globalAttemptIdRef = useRef(0);
  const didCompleteRef = useRef(false);
  const timeoutIdRef = useRef(null);
  const timeoutControllerRef = useRef(null);
  const flowIdRef = useRef(
    `auth-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  const sessionRef = useRef(null);
  const authAttemptIdRef = useRef(authAttemptId);

  const authDiagLog = useCallback(
    (event, payload = {}) => {
      if (!authDiagEnabled || typeof window === "undefined") return;
      const timestamp = new Date().toISOString();
      console.log("[AUTH_DIAG]", {
        timestamp,
        pathname: window.location.pathname,
        search: window.location.search,
        flowId: flowIdRef.current,
        event,
        ...payload,
      });
    },
    [authDiagEnabled]
  );

  const closeAuthAttempt = useCallback(
    (reason) => {
      if (!globalAttemptIdRef.current) return;
      endAuthAttempt(globalAttemptIdRef.current, reason);
      authDiagLog("auth:attempt:end", {
        action: "business_login",
        attemptId: globalAttemptIdRef.current,
        reason,
      });
      globalAttemptIdRef.current = 0;
    },
    [authDiagLog, endAuthAttempt]
  );

  useEffect(() => {
    authAttemptIdRef.current = authAttemptId;
  }, [authAttemptId]);

  const getCookieStatus = useCallback(() => {
    if (typeof document === "undefined") return null;
    const cookieName = getCookieName();
    const cookieLength = document.cookie.length;
    const names = document.cookie
      .split(";")
      .map((entry) => entry.trim().split("=")[0])
      .filter(Boolean);
    const hasAuthCookie = cookieName
      ? names.some(
          (name) => name === cookieName || name.startsWith(`${cookieName}.`)
        )
      : false;
    return {
      cookieName,
      cookieLength,
      hasAuthCookie,
    };
  }, []);

  const waitForAuthCookie = useCallback(async (timeoutMs = 2500) => {
    if (typeof document === "undefined") return false;
    const cookieName = getCookieName();
    if (!cookieName) return false;

    const hasAuthCookie = () => {
      const names = document.cookie
        .split(";")
        .map((entry) => entry.trim().split("=")[0])
        .filter(Boolean);
      return names.some(
        (name) => name === cookieName || name.startsWith(`${cookieName}.`)
      );
    };

    if (hasAuthCookie()) return true;

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (hasAuthCookie()) return true;
    }

    return false;
  }, []);

  const finishBusinessAuth = useCallback(
    (target = PATHS.business.dashboard) => {
      if (redirectingRef.current) return;
      redirectingRef.current = true;
      authDiagLog("redirect:start", { target, isPopup });

      if (typeof window !== "undefined") {
        try {
          // Broadcast success so other tabs (the opener) can react
          localStorage.setItem("business_auth_redirect", target);
          localStorage.setItem("business_auth_success", Date.now().toString());

          if (typeof BroadcastChannel !== "undefined") {
            const channel = new BroadcastChannel("yb-business-auth");
            channel.postMessage({ type: "YB_BUSINESS_AUTH_SUCCESS", target });
            channel.close();
          }
        } catch (err) {
          console.warn("Could not broadcast business auth success", err);
        }

        if (isPopup) {
          // Close popup when possible; fall back to in-tab redirect if blocked
          if (window.opener && window.location.origin) {
            try {
              authDiagLog("popup:postMessage", { target });
              window.opener.postMessage(
                { type: "YB_BUSINESS_AUTH_SUCCESS", target },
                window.location.origin
              );
            } catch (err) {
              console.warn("Popup postMessage failed", err);
            }
          }
          setTimeout(() => {
            window.close();

            // Some browsers ignore close() if not opened by script
            setTimeout(() => {
              if (!window.closed) {
                authDiagLog("popup:close:blocked", { target });
                authDiagLog("redirect:assign", { target });
                window.location.replace(target);
              }
            }, 250);
          }, 250);

          return;
        }
      }

      authDiagLog("redirect:assign", { target });
      window.location.replace(target);
    },
    [authDiagLog, isPopup]
  );

  const redirectToDashboard = useCallback(async () => {
    if (redirectingRef.current) return;
    await waitForAuthCookie();
    finishBusinessAuth();
  }, [finishBusinessAuth, waitForAuthCookie]);

  const handleLoginTimeout = useCallback(
    async (attemptId, timeoutController) => {
      if (didCompleteRef.current || attemptRef.current !== attemptId) return;
      timeoutController.abort(new Error("timeout"));
      pendingRef.current = false;

      let activeSession = sessionRef.current;
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          activeSession = data.session;
          sessionRef.current = data.session;
        }
      } catch (err) {
        console.warn("Could not read session after timeout", err);
      }

      authDiagLog("login:timeout", {
        attemptId,
        hasSession: Boolean(activeSession),
      });

      if (activeSession) {
        didCompleteRef.current = true;
        if (mountedRef.current) {
          setLoading(false);
        }
        closeAuthAttempt("session");
        await redirectToDashboard();
        return;
      }

      if (mountedRef.current) {
        setLoading(false);
        setAuthError("Login timed out. Please try again.");
      }
      closeAuthAttempt("timeout");
    },
    [authDiagLog, closeAuthAttempt, redirectToDashboard, supabase]
  );

  useEffect(() => {
    if (authStatus !== "authenticated" || !user?.id || role !== "business") return;
    didCompleteRef.current = true;
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }
    pendingRef.current = false;
    if (mountedRef.current) {
      setLoading(false);
    }
    closeAuthAttempt("session");
    authDiagLog("login:session:ready", { userId: user.id });
    void redirectToDashboard();
  }, [
    authStatus,
    authDiagLog,
    closeAuthAttempt,
    redirectToDashboard,
    role,
    user?.id,
  ]);

  async function handleLogin(e) {
    e.preventDefault();
    if (pendingRef.current || loading) return;
    if (!supabase) {
      setAuthError("Auth client not ready. Please refresh and try again.");
      return;
    }
    globalAttemptIdRef.current = beginAuthAttempt("business_login");
    authDiagLog("auth:attempt:begin", {
      action: "business_login",
      attemptId: globalAttemptIdRef.current,
    });
    const attemptId = attemptRef.current + 1;
    attemptRef.current = attemptId;
    didCompleteRef.current = false;
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }
    if (timeoutControllerRef.current) {
      timeoutControllerRef.current.abort();
    }

    const timeoutController = new AbortController();
    timeoutControllerRef.current = timeoutController;
    timeoutIdRef.current = setTimeout(() => {
      void handleLoginTimeout(attemptId, timeoutController);
    }, 20000);

    pendingRef.current = true;
    if (mountedRef.current) {
      setLoading(true);
      setAuthError("");
    }
    authDiagLog("login:submit:start", { attemptId, isPopup });

    try {
      try {
        localStorage.setItem("signup_role", "business");
      } catch (err) {
        console.warn("Could not set signup role", err);
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      authDiagLog("login:signIn:result", {
        attemptId,
        hasSession: Boolean(data?.session),
        error: error?.message ?? null,
      });

      if (timeoutController.signal.aborted || attemptRef.current !== attemptId) {
        return;
      }

      if (error) {
        throw error;
      }

      const user = data.user;
      sessionRef.current = data?.session ?? null;

      const profileQuery = supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      const profileResult =
        typeof profileQuery.abortSignal === "function"
          ? await profileQuery.abortSignal(timeoutController.signal)
          : await profileQuery;
      const { data: profile, error: profileErr } = profileResult;

      if (timeoutController.signal.aborted || attemptRef.current !== attemptId) {
        return;
      }

      if (profileErr) {
        throw profileErr;
      }

      if (profile?.role !== "business") {
        await supabase.auth.signOut();
        throw new Error("Only business accounts can log in here.");
      }

      const session = sessionRef.current;
      if (session?.access_token && session?.refresh_token) {
        const response = await fetchWithTimeout("/api/auth/refresh", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            }),
            timeoutMs: 15000,
            signal: timeoutController.signal,
          });

        if (timeoutController.signal.aborted || attemptRef.current !== attemptId) {
          return;
        }

        if (!response.ok) {
          throw new Error("Session refresh failed. Please try again.");
        }
      }

      didCompleteRef.current = true;
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      await redirectToDashboard();
      authDiagLog("login:submit:success", { attemptId });
    } catch (err) {
      if (
        timeoutController.signal.aborted ||
        attemptRef.current !== attemptId
      ) {
        authDiagLog("login:submit:aborted", { attemptId });
        return;
      }
      if (!didCompleteRef.current && attemptRef.current === attemptId) {
        console.error("Business login failed", err);
        const message =
          err?.message ?? "Login failed. Please refresh and try again.";
        authDiagLog("login:submit:error", { attemptId, message });
        alert(message);
        if (mountedRef.current) {
          setAuthError(message);
        }
      }
    } finally {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      if (attemptRef.current === attemptId) {
        pendingRef.current = false;
        if (mountedRef.current) {
          setLoading(false);
        }
      }
      closeAuthAttempt("password");
      authDiagLog("login:submit:end", { attemptId });
    }
  }

  async function handleGoogleLogin() {
    if (pendingRef.current || loading) return;
    if (!supabase) {
      setAuthError("Auth client not ready. Please refresh and try again.");
      return;
    }
    let attemptId = 0;
    try {
      attemptId = beginAuthAttempt("business_oauth");
      globalAttemptIdRef.current = attemptId;
      authDiagLog("auth:attempt:begin", {
        action: "business_oauth",
        attemptId,
      });
      pendingRef.current = true;
      if (mountedRef.current) {
        setLoading(true);
        setAuthError("");
      }

      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const redirectTo = `${origin}/api/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });

      if (error) {
        console.error("Google login error:", error);
        alert("Failed to sign in with Google.");
        if (mountedRef.current) {
          setAuthError("Failed to sign in with Google.");
          setLoading(false);
        }
        pendingRef.current = false;
        return;
      }
    } finally {
      if (attemptId) {
        endAuthAttempt(attemptId, "oauth");
        authDiagLog("auth:attempt:end", {
          action: "business_oauth",
          attemptId,
        });
        if (globalAttemptIdRef.current === attemptId) {
          globalAttemptIdRef.current = 0;
        }
      }
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      if (timeoutControllerRef.current) {
        timeoutControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (!globalAttemptIdRef.current) return;
    if (authAttemptIdRef.current === globalAttemptIdRef.current) return;
    authDiagLog("login:stale:reset", {
      attemptId: globalAttemptIdRef.current,
      currentAttemptId: authAttemptIdRef.current,
    });
    globalAttemptIdRef.current = 0;
    pendingRef.current = false;
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }
    if (timeoutControllerRef.current) {
      timeoutControllerRef.current.abort();
    }
    if (mountedRef.current) {
      setLoading(false);
      setAuthError("");
    }
  }, [authAttemptId, authDiagLog]);

  useEffect(() => {
    if (!authDiagEnabled) return;

    try {
      sessionStorage.setItem("auth_flow_id", flowIdRef.current);
    } catch (err) {
      console.warn("Could not persist auth flow id", err);
    }

    authDiagLog("login:mount", { popup: isPopup });
    const cookieStatus = getCookieStatus();
    authDiagLog("login:cookies", cookieStatus ?? {});

    const handleError = (event) => {
      authDiagLog("login:window:error", {
        message: event?.message ?? null,
        filename: event?.filename ?? null,
        lineno: event?.lineno ?? null,
        colno: event?.colno ?? null,
      });
    };

    const handleRejection = (event) => {
      const reason = event?.reason;
      authDiagLog("login:window:unhandledrejection", {
        reason: reason?.message ?? String(reason ?? ""),
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, [authDiagEnabled, authDiagLog, getCookieStatus, isPopup]);

  useEffect(() => {
    if (!authDiagEnabled || !supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      authDiagLog("auth:event", {
        event,
        hasSession: Boolean(session),
      });
    });
    return () => {
      data?.subscription?.unsubscribe();
    };
  }, [authDiagEnabled, authDiagLog, supabase]);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="w-full flex justify-center px-4 mt-24 grow">
        <div
          className="max-w-md w-full max-h-[420px] p-8 rounded-2xl backdrop-blur-xl overflow-y-auto animate-fadeIn"
          style={{
            background: "rgba(30, 41, 59, 0.4)",
            border: "1px solid rgba(51, 65, 85, 0.5)",
            boxShadow: "0 0 50px -12px rgba(0, 0, 0, 0.5)",
          }}
        >
          <h1
            className="text-3xl font-extrabold text-center mb-3 tracking-tight"
            style={{ color: "#fff" }}
          >
            Business Login
          </h1>

          <p className="text-center mb-6" style={{ color: "#94a3b8" }}>
            Sign in to manage your business
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            {authError ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {authError}
              </div>
            ) : null}
            <input
              id="business-login-email"
              name="email"
              type="email"
              placeholder="Email"
              className="w-full px-4 py-3 rounded-xl transition focus:outline-none focus:ring-2"
              style={{
                background: "rgba(30, 41, 59, 0.5)",
                border: "1px solid rgba(71, 85, 105, 0.3)",
                color: "#fff",
              }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <input
              id="business-login-password"
              name="password"
              type="password"
              placeholder="Password"
              className="w-full px-4 py-3 rounded-xl transition focus:outline-none focus:ring-2"
              style={{
                background: "rgba(30, 41, 59, 0.5)",
                border: "1px solid rgba(71, 85, 105, 0.3)",
                color: "#fff",
              }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-lg active:scale-[0.98] transition-all duration-200"
              style={{
                background: "#2563eb",
                color: "#fff",
                boxShadow: "0 10px 15px -3px rgba(30, 58, 138, 0.3)",
                opacity: loading ? 0.6 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Signing in..." : "Log in"}
            </button>
          </form>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full mt-5 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition"
            style={{
              background: "rgba(51, 65, 85, 0.5)",
              border: "1px solid rgba(71, 85, 105, 0.3)",
              color: "#fff",
            }}
          >
            <img src="/google-icon.svg" className="h-5 w-5" alt="Google" />
            Continue with Google
          </button>

          <p className="text-center text-sm mt-4" style={{ color: "#94a3b8" }}>
            Don&apos;t have an account?{" "}
            <a
              href="/business-auth/register"
              className="font-medium hover:underline"
              style={{ color: "#60a5fa" }}
            >
              Sign up
            </a>
          </p>
        </div>

        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeIn {
            animation: fadeIn 0.6s ease-out;
          }
          .business-auth-page input::placeholder {
            color: #94a3b8;
          }
          .business-auth-page input:focus {
            border-color: rgba(59, 130, 246, 0.5);
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
          }
          .business-auth-page button:hover:not(:disabled) {
            filter: brightness(1.1);
          }
        `}</style>
      </div>
    </div>
  );
}

export default function BusinessLoginClient() {
  return (
    <Suspense fallback={<div className="w-full max-w-2xl min-h-[420px]" />}>
      <BusinessLoginInner />
    </Suspense>
  );
}
