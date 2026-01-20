"use client";

import { useEffect, useRef, useState } from "react";
import BaseModal from "./BaseModal";
import { useAuth } from "../AuthProvider";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient";
import { useModal } from "./ModalProvider";

export default function CustomerLoginModal({ onClose }) {
  const {
    supabase,
    loadingUser,
    beginAuthAttempt,
    endAuthAttempt,
    authAttemptId,
    authStatus,
    user,
    role,
  } = useAuth();
  const { openModal } = useModal();
  const authDiagEnabled = process.env.NEXT_PUBLIC_AUTH_DIAG === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const attemptIdRef = useRef(0);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!attemptIdRef.current) return;
    if (authAttemptId === attemptIdRef.current) return;
    attemptIdRef.current = 0;
    setLoading(false);
  }, [authAttemptId]);

  useEffect(() => {
    if (authStatus !== "authenticated" || !user?.id) return;
    const dest =
      role === "business" ? "/business/dashboard" : "/customer/home";
    onClose?.();
    window.location.replace(dest);
  }, [authStatus, onClose, role, user?.id]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    const client = supabase ?? getBrowserSupabaseClient();

    if (authDiagEnabled) {
      console.log("[AUTH_DIAG] customer login submit", {
        route: typeof window !== "undefined" ? window.location.pathname : null,
        supabaseType: typeof supabase,
        supabaseKeys: supabase ? Object.keys(supabase) : null,
        hasSupabaseAuth: Boolean(supabase?.auth),
        clientType: typeof client,
        clientKeys: client ? Object.keys(client) : null,
        hasClientAuth: Boolean(client?.auth),
        hasModalContext: typeof openModal === "function",
      });
    }

    if (!client || !client.auth) {
      setError("Auth is unavailable. Please refresh and try again.");
      return;
    }

    const attemptId = beginAuthAttempt("customer_login");
    attemptIdRef.current = attemptId;
    setLoading(true);

    const isStale = () => attemptIdRef.current !== attemptId;
    const finishAttempt = (result) => {
      endAuthAttempt(attemptId, result);
      if (attemptIdRef.current !== attemptId) return;
      attemptIdRef.current = 0;
      setLoading(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    if (authDiagEnabled) {
      console.log("[AUTH_DIAG] customer:login:begin", {
        attemptId,
        pathname: typeof window !== "undefined" ? window.location.pathname : null,
      });
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      if (attemptIdRef.current !== attemptId) return;
      setError("Login timed out. Please try again.");
      finishAttempt("timeout");
    }, 25000);

    try {
      const { data, error: signInError } = await client.auth.signInWithPassword(
        { email, password }
      );

      if (isStale()) return;
      if (signInError) {
        setError(signInError.message);
        return;
      }

      const user = data?.user;
      if (!user) {
        setError("Login succeeded but no user was returned. Try again.");
        return;
      }

      const { data: profile, error: profileError } = await client
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (isStale()) return;
      if (profileError) {
        setError("Logged in, but could not load your profile. Try again.");
        return;
      }

      const dest =
        profile?.role === "business"
          ? "/business/dashboard"
          : "/customer/home";

      onClose?.();

      const debugAuth = process.env.NEXT_PUBLIC_DEBUG_AUTH === "1";

      try {
        const session = data?.session;

        if (debugAuth) {
          console.log("[customer-login] refreshing cookies with tokens");
        }

        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: session?.access_token,
            refresh_token: session?.refresh_token,
          }),
        });

        if (isStale()) return;
        const refreshed = res.headers.get("x-auth-refresh-user") === "1";
        if (debugAuth) {
          console.log(
            "[customer-login] refresh user header",
            res.headers.get("x-auth-refresh-user")
          );
        }

        if (!refreshed) {
          setError(
            "Login succeeded but session could not be persisted in Safari. Please try again."
          );
          return;
        }
      } catch (err) {
        console.error("Auth refresh call failed", err);
        setError(
          "Login succeeded but session could not be persisted in Safari. Please try again."
        );
        return;
      }

      window.location.replace(dest);
    } catch (err) {
      if (isStale()) return;
      console.error("Customer login failed", err);
      setError("Login failed. Please try again.");
    } finally {
      finishAttempt("password");
      if (authDiagEnabled) {
        console.log("[AUTH_DIAG] customer:login:end", {
          attemptId,
          pathname: typeof window !== "undefined" ? window.location.pathname : null,
        });
      }
    }
  }

  async function handleGoogleLogin() {
    setError("");

    let attemptId = 0;
    try {
      const client = supabase ?? getBrowserSupabaseClient();
      if (!client || !client.auth) {
        setError("Auth is unavailable. Please refresh and try again.");
        return;
      }

      attemptId = beginAuthAttempt("customer_oauth");
      attemptIdRef.current = attemptId;
      setLoading(true);

      const { error: oauthError } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });

      if (attemptIdRef.current !== attemptId) return;
      if (oauthError) {
        setError(oauthError.message);
      } else {
        onClose?.();
      }
    } catch (err) {
      console.error("Customer OAuth login failed", err);
      setError("Login failed. Please try again.");
    } finally {
      if (attemptId) {
        const finished = endAuthAttempt(attemptId, "oauth");
        if (finished) {
          attemptIdRef.current = 0;
          setLoading(false);
        }
      }
    }
  }

  return (
    <BaseModal
      title="Welcome back"
      description="Sign in to your customer account to continue exploring nearby businesses."
      onClose={onClose}
    >
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="customer-login-email" className="text-sm text-slate-700">Email</label>
          <input
            id="customer-login-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="
              w-full px-4 py-3 rounded-xl 
              bg-slate-50 border border-slate-200 
              text-slate-900 placeholder-slate-400
              focus:ring-2 focus:ring-pink-500/40 focus:border-pink-400
              transition
            "
            disabled={loading || loadingUser}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="customer-login-password" className="text-sm text-slate-700">Password</label>
          <input
            id="customer-login-password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="
              w-full px-4 py-3 rounded-xl 
              bg-slate-50 border border-slate-200 
              text-slate-900 placeholder-slate-400
              focus:ring-2 focus:ring-pink-500/40 focus:border-pink-400
              transition
            "
            disabled={loading || loadingUser}
          />
        </div>

        {error ? (
          <div className="rounded-lg border border-red-500/20 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading || loadingUser}
          className={`
            w-full py-3 rounded-xl font-semibold text-white text-base
            bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500
            shadow-lg shadow-pink-500/30 
            hover:brightness-110 active:scale-[0.98]
            transition-all duration-200
            ${(loading || loadingUser) ? "opacity-60 cursor-not-allowed" : ""}
          `}
        >
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>

      <div className="mt-4">
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading || loadingUser}
          className="
            w-full py-3 rounded-xl font-medium
            bg-white border border-slate-200 text-slate-900
            hover:bg-slate-50
            flex items-center justify-center gap-2
            transition
            disabled:opacity-60 disabled:cursor-not-allowed
          "
        >
          <img src="/google-icon.svg" className="h-5 w-5" alt="Google" />
          Continue with Google
        </button>
      </div>

      <p className="mt-4 text-center text-sm text-slate-700">
        New to YourBarrio?{" "}
        <button
          type="button"
          onClick={() => openModal("customer-signup")}
          className="text-pink-600 font-semibold hover:underline"
        >
          Create an account
        </button>
      </p>
    </BaseModal>
  );
}
