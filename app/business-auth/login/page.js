"use client";

import { Suspense } from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getCookieName } from "@/lib/supabaseClient";

function BusinessLoginInner() {
  const { supabase, authUser, role, loadingUser } = useAuth();
  const searchParams = useSearchParams();
  const isPopup = searchParams?.get("popup") === "1";
  const authDiagEnabled = process.env.NEXT_PUBLIC_AUTH_DIAG === "1";

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const redirectingRef = useRef(false);
  const flowIdRef = useRef(
    `auth-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );

  const authDiagLog = useCallback(
    (event, payload = {}) => {
      if (!authDiagEnabled || typeof window === "undefined") return;
      const timestamp = new Date().toISOString();
      // eslint-disable-next-line no-console
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

  const waitForSession = useCallback(
    async (timeoutMs = 2000) => {
      if (!supabase) return false;
      const start = Date.now();
      let attempt = 0;

      while (Date.now() - start < timeoutMs) {
        attempt += 1;
        try {
          const { data, error } = await supabase.auth.getSession();
          const session = data?.session;
          const cookieStatus = getCookieStatus();

          authDiagLog("login:pollSession", {
            attempt,
            hasSession: Boolean(session?.access_token),
            cookieLength: cookieStatus?.cookieLength ?? null,
            hasAuthCookie: cookieStatus?.hasAuthCookie ?? null,
            error: error?.message ?? null,
          });

          if (session?.access_token) return true;
        } catch (err) {
          authDiagLog("login:pollSession:error", {
            attempt,
            error: err?.message ?? String(err),
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      return false;
    },
    [authDiagLog, getCookieStatus, supabase]
  );

  const finishBusinessAuth = useCallback((target = "/business/dashboard") => {
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
            window.opener.postMessage(
              { type: "YB_BUSINESS_AUTH_SUCCESS", target },
              window.location.origin
            );
          } catch (err) {
            console.warn("Popup postMessage failed", err);
          }
        }
        window.close();

        // Some browsers ignore close() if not opened by script
        setTimeout(() => {
          if (!window.closed) {
            authDiagLog("popup:close:blocked", { target });
            authDiagLog("redirect:assign", { target });
            window.location.replace(target);
          }
        }, 150);

        return;
      }
    }

    // Use full page reload to ensure session is properly loaded
    authDiagLog("redirect:assign", { target });
    window.location.replace(target);
  }, [authDiagLog, isPopup]);

  const redirectToDashboard = useCallback(async () => {
    if (redirectingRef.current) return;
    await Promise.all([waitForAuthCookie(), waitForSession()]);
    finishBusinessAuth();
  }, [finishBusinessAuth, waitForAuthCookie, waitForSession]);

  /* --------------------------------------------------------------
     AUTO-REDIRECT IF ALREADY LOGGED IN
  -------------------------------------------------------------- */
  useEffect(() => {
    if (loadingUser) return;
    if (!authUser) return;
    if (!role) return; // wait until role is loaded

    // Add delay to ensure session is fully established and AuthProvider state is ready
    const timer = setTimeout(() => {
      if (role === "business") {
        console.log("Login: Redirecting to dashboard, authUser:", authUser.id);
        redirectToDashboard();
      } else {
        window.location.replace("/customer/home"); // non-business users redirected
      }
    }, 200); // Increased from 50ms to 200ms

    return () => clearTimeout(timer);
  }, [authUser, role, loadingUser, redirectToDashboard]);

  /* --------------------------------------------------------------
     EMAIL + PASSWORD LOGIN  (FIXED)
  -------------------------------------------------------------- */
  async function handleLogin(e) {
    e.preventDefault();
    if (!supabase) {
      setAuthError("Auth client not ready. Please refresh and try again.");
      return;
    }
    setLoading(true);
    setAuthError("");

    try {
      // 🔥 Tell AuthProvider this login belongs to a business account
      try {
        localStorage.setItem("signup_role", "business");
      } catch (err) {
        console.warn("Could not set signup role", err);
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      const user = data.user;

      // 2) 🔥 Fetch role immediately from DB (reliable)
      const { data: profile, error: profileErr } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileErr) {
        throw profileErr;
      }

      // 3) Role check
      if (profile?.role !== "business") {
        await supabase.auth.signOut();
        throw new Error("Only business accounts can log in here.");
      }

      // 4) Wait for session to be fully written to storage before allowing redirect
      // This ensures the AuthProvider and dashboard can read the session immediately
      console.log("Login: Waiting for session to stabilize...");
      await new Promise(resolve => setTimeout(resolve, 500));

      // 5) Verify session is accessible
      const { data: sessionCheck } = await supabase.auth.getSession();
      const session = sessionCheck?.session;
      console.log(
        "Login: Session check before redirect:",
        session ? "Session exists" : "No session"
      );

      // 6) Sync auth cookies for SSR before navigating
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: session?.access_token,
          refresh_token: session?.refresh_token,
        }),
      });

      const refreshed = res.headers.get("x-auth-refresh-user") === "1";
      if (!refreshed) {
        throw new Error(
          "Login succeeded but session could not be persisted. Please refresh and try again."
        );
      }

      // 7) Ensure the auth cookie is present before navigating (prevents blank dashboard)
      await redirectToDashboard();
    } catch (err) {
      console.error("Business login failed", err);
      const message =
        err?.message ?? "Login failed. Please refresh and try again.";
      alert(message);
      setAuthError(message);
    } finally {
      setLoading(false);
    }
  }

  /* --------------------------------------------------------------
     GOOGLE LOGIN
     (business login disabled, still customer-only)
  -------------------------------------------------------------- */
  async function handleGoogleLogin() {
    setLoading(true);
    setAuthError("");

    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
      const redirectTo = `${origin}/business-auth/login?oauth=1`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) {
      console.error("Google login error:", error);
      alert("Failed to sign in with Google.");
      setAuthError("Failed to sign in with Google.");
      setLoading(false);
      return;
    }
  }

  /* --------------------------------------------------------------
     AUTH LOADING
  -------------------------------------------------------------- */
  useEffect(() => {
    if (!authDiagEnabled || !supabase) return;

    try {
      sessionStorage.setItem("auth_flow_id", flowIdRef.current);
    } catch (err) {
      console.warn("Could not persist auth flow id", err);
    }

    authDiagLog("login:mount", { popup: isPopup });
    const cookieStatus = getCookieStatus();
    authDiagLog("login:cookies", cookieStatus ?? {});

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        authDiagLog("login:getSession", {
          hasSession: Boolean(data?.session),
          error: error?.message ?? null,
        });
      })
      .catch((err) => {
        authDiagLog("login:getSession:error", {
          error: err?.message ?? String(err),
        });
      });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        authDiagLog("login:onAuthStateChange", {
          event,
          hasSession: Boolean(session),
        });
      }
    );

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
      listener?.subscription?.unsubscribe();
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, [authDiagEnabled, authDiagLog, getCookieStatus, isPopup, supabase]);

  /* --------------------------------------------------------------
     UI — PROFESSIONAL BUSINESS STYLE
  -------------------------------------------------------------- */
  return (
    <div className="min-h-screen flex flex-col">
      <div className="w-full flex justify-center px-4 mt-24 grow">
        <div
          className="max-w-md w-full max-h-[420px] p-8 rounded-2xl backdrop-blur-xl overflow-y-auto animate-fadeIn"
          style={{
            background: 'rgba(30, 41, 59, 0.4)',
            border: '1px solid rgba(51, 65, 85, 0.5)',
            boxShadow: '0 0 50px -12px rgba(0, 0, 0, 0.5)',
          }}
        >
          <h1 className="text-3xl font-extrabold text-center mb-3 tracking-tight" style={{ color: '#fff' }}>
            Business Login
          </h1>

          <p className="text-center mb-6" style={{ color: '#94a3b8' }}>
            Sign in to manage your business
          </p>

          {/* EMAIL/PASSWORD FORM */}
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
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(71, 85, 105, 0.3)',
                color: '#fff',
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
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(71, 85, 105, 0.3)',
                color: '#fff',
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
                background: '#2563eb',
                color: '#fff',
                boxShadow: '0 10px 15px -3px rgba(30, 58, 138, 0.3)',
                opacity: loading ? 0.6 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? "Signing in..." : "Log in"}
            </button>
          </form>

          {/* GOOGLE LOGIN */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full mt-5 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition"
            style={{
              background: 'rgba(51, 65, 85, 0.5)',
              border: '1px solid rgba(71, 85, 105, 0.3)',
              color: '#fff',
            }}
          >
            <img src="/google-icon.svg" className="h-5 w-5" alt="Google" />
            Continue with Google
          </button>

          {/* SIGNUP LINK */}
          <p className="text-center text-sm mt-4" style={{ color: '#94a3b8' }}>
            Don't have an account?{" "}
            <a
              href="/business-auth/register"
              className="font-medium hover:underline"
              style={{ color: '#60a5fa' }}
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

/* --------------------------------------------------------------
   EXPORT WITH SUSPENSE — required for useSearchParams
-------------------------------------------------------------- */
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-2xl min-h-[420px]" />}>
      <BusinessLoginInner />
    </Suspense>
  );
}
