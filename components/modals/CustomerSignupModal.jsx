"use client";

import { useRef, useState } from "react";
import BaseModal from "./BaseModal";
import { useAuth } from "../AuthProvider";
import { useModal } from "./ModalProvider";
import { buildOAuthCallbackUrl, logOAuthStart } from "@/lib/auth/oauthRedirect";
import { markCustomerProfilePromptPending } from "@/components/customer/CustomerPostSignupProfilePrompt";

function resolveSignupDestination(next) {
  if (typeof next !== "string") return "/customer/home";
  const trimmed = next.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/customer/home";
  }
  if (trimmed.startsWith("/api/") || trimmed.startsWith("/_next/")) {
    return "/customer/home";
  }
  return trimmed;
}

export default function CustomerSignupModal({ onClose, next = null }) {
  const { supabase } = useAuth();
  const { openModal } = useModal();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submitLockRef = useRef(false);

  const friendlyExistingAccountMessage =
    "An account with this email already exists. Log in instead.";
  const destination = resolveSignupDestination(next);

  function isAlreadyRegisteredError(authError) {
    const message = String(authError?.message || "").toLowerCase();
    const code = String(authError?.code || authError?.name || "").toLowerCase();
    return (
      message.includes("user already registered") ||
      message.includes("already registered") ||
      code.includes("user_already_exists") ||
      code.includes("email_exists")
    );
  }

  async function persistSession(session) {
    const debugAuth = process.env.NEXT_PUBLIC_DEBUG_AUTH === "1";

    if (!session?.access_token || !session?.refresh_token) {
      const { data } = await supabase.auth.getSession();
      session = data?.session;
    }

    if (!session?.access_token || !session?.refresh_token) {
      throw new Error("missing_session");
    }

    if (debugAuth) {
      console.log("[customer-signup] refreshing cookies with tokens");
    }

    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      }),
    });

    const refreshed = res.headers.get("x-auth-refresh-user") === "1";
    if (debugAuth) {
      console.log(
        "[customer-signup] refresh user header",
        res.headers.get("x-auth-refresh-user")
      );
    }

    if (!refreshed) {
      throw new Error("refresh_failed");
    }

    return session;
  }

  async function fetchFreshProfile() {
    const res = await fetch("/api/me", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: {
        "x-yb-auth-bootstrap": "customer_signup",
      },
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload?.user?.id || !payload?.profile?.id) {
      throw new Error(payload?.error || "profile_missing");
    }
    return payload;
  }

  async function recoverExistingSessionForEmail() {
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    const sessionEmail = String(session?.user?.email || "").trim().toLowerCase();
    const requestedEmail = String(email || "").trim().toLowerCase();

    if (!session?.user?.id || !requestedEmail || sessionEmail !== requestedEmail) {
      return false;
    }

    await persistSession(session);
    await fetchFreshProfile();
    onClose?.();
    window.location.replace(destination);
    return true;
  }

  async function handleSignup(event) {
    event.preventDefault();
    if (submitLockRef.current) return;

    submitLockRef.current = true;
    setError("");
    setLoading(true);

    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: "customer",
          },
        },
      });

      if (signUpError) {
        if (isAlreadyRegisteredError(signUpError)) {
          const recovered = await recoverExistingSessionForEmail();
          if (!recovered) {
            setError(friendlyExistingAccountMessage);
          }
        } else {
          setError(signUpError.message);
        }
        return;
      }

      const authUser = signUpData?.user;
      if (!authUser) {
        setError("Signup succeeded but no user returned. Try logging in.");
        return;
      }

      await persistSession(signUpData?.session);
      await fetchFreshProfile();
      markCustomerProfilePromptPending(authUser.id);

      onClose?.();
      window.location.replace(destination);
    } catch (err) {
      console.error("Customer signup completion failed", err);
      if (err?.message === "missing_session" || err?.message === "refresh_failed") {
        setError(
          "Signup succeeded but session could not be persisted in Safari. Please try again."
        );
        return;
      }
      setError("Account created, but failed to finish profile. Try logging in.");
    } finally {
      submitLockRef.current = false;
      setLoading(false);
    }
  }

  async function handleGoogleSignup() {
    setError("");
    setLoading(true);

    const currentOrigin =
      typeof window !== "undefined" ? window.location.origin : "";
    const redirectTo = buildOAuthCallbackUrl({ currentOrigin });
    logOAuthStart({ provider: "google", redirectTo, currentOrigin });

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      // Use shared OAuth callback to exchange code + create profile
      options: { redirectTo },
    });

    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
      return;
    }

    onClose?.();
  }

  return (
    <BaseModal
      title="Create your customer account"
      description="Join YourBarrio to save your favorite local businesses and see recommendations near you."
      onClose={onClose}
    >
      <form onSubmit={handleSignup} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="customer-signup-email" className="text-sm text-slate-700">Email</label>
          <input
            id="customer-signup-email"
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
              focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-400
              transition
            "
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="customer-signup-password" className="text-sm text-slate-700">Password</label>
          <input
            id="customer-signup-password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="
              w-full px-4 py-3 rounded-xl 
              bg-slate-50 border border-slate-200 
              text-slate-900 placeholder-slate-400
              focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-400
              transition
            "
            disabled={loading}
          />
        </div>

        {error ? (
          <div className="rounded-lg border border-red-500/20 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="yb-primary-button mt-2 w-full rounded-xl py-3 text-base font-semibold text-white"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <div className="mt-4">
        <button
          type="button"
          onClick={handleGoogleSignup}
          disabled={loading}
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
        Already have an account?{" "}
        <button
          type="button"
          onClick={() => openModal("customer-login")}
          className="text-pink-600 font-semibold hover:underline"
        >
          Log in
        </button>
      </p>
    </BaseModal>
  );
}
