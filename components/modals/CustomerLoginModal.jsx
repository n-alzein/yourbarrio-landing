"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import BaseModal from "./BaseModal";
import { useAuth } from "../AuthProvider";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient";
import { useModal } from "./ModalProvider";

export default function CustomerLoginModal({ onClose }) {
  const searchParams = useSearchParams();
  const { supabase, loadingUser } = useAuth();
  const { openModal } = useModal();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword(
      { email, password }
    );

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    const user = data?.user;
    if (!user) {
      setError("Login succeeded but no user was returned. Try again.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      setError("Logged in, but could not load your profile. Try again.");
      setLoading(false);
      return;
    }

    const redirectParam = searchParams?.get("redirect");
    const fallback =
      profile?.role === "business"
        ? "/business/dashboard"
        : "/customer/home";
    const dest = redirectParam || fallback;

    onClose?.();

    const debugAuth = process.env.NEXT_PUBLIC_DEBUG_AUTH === "1";

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

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
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error("Auth refresh call failed", err);
      setError(
        "Login succeeded but session could not be persisted in Safari. Please try again."
      );
      setLoading(false);
      return;
    }

    window.location.assign(dest);
    setLoading(false);
  }

  async function handleGoogleLogin() {
    setError("");
    setLoading(true);

    const client = getBrowserSupabaseClient();
    await client.auth.getSession();

    const { error: oauthError } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/oauth/callback`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    } else {
      onClose?.();
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
