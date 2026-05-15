"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import BaseModal from "./BaseModal";
import { useAuth } from "../AuthProvider";
import { useModal } from "./ModalProvider";
import { buildOAuthCallbackUrl, logOAuthStart } from "@/lib/auth/oauthRedirect";
import { markCustomerProfilePromptPending } from "@/components/customer/CustomerPostSignupProfilePrompt";
import {
  authErrorClassName,
  authGoogleButtonClassName,
  authInputClassName,
  authLabelClassName,
  authPrimaryButtonClassName,
  authSwitchLinkClassName,
} from "@/components/auth/authFormStyles";

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
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [legalAttempted, setLegalAttempted] = useState(false);
  const [legalError, setLegalError] = useState("");
  const submitLockRef = useRef(false);

  const friendlyExistingAccountMessage =
    "An account with this email already exists. Log in instead.";
  const legalAcceptanceError =
    "Please accept the Terms of Service and Privacy Policy to continue.";
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

  async function recordLegalAcceptance() {
    const res = await fetch("/api/account/legal-acceptances", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_terms_accepted: true,
        source: "signup",
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload?.error || "legal_acceptance_failed");
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
    setLegalAttempted(true);
    setLegalError("");

    if (!legalAccepted) {
      setLegalError(legalAcceptanceError);
      submitLockRef.current = false;
      return;
    }

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
      await recordLegalAcceptance();
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
    setLegalAttempted(true);
    setLegalError("");

    if (!legalAccepted) {
      setLegalError(legalAcceptanceError);
      return;
    }

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
          <label htmlFor="customer-signup-email" className={authLabelClassName}>Email</label>
          <input
            id="customer-signup-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={authInputClassName}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="customer-signup-password" className={authLabelClassName}>Password</label>
          <input
            id="customer-signup-password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={authInputClassName}
            disabled={loading}
          />
        </div>

        <div className="pt-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-700">
              <input
                type="checkbox"
                checked={legalAccepted}
                onChange={(event) => {
                  setLegalAccepted(event.target.checked);
                  if (event.target.checked) setLegalError("");
                }}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-2 focus:ring-purple-500/40"
                disabled={loading}
              />
              <span>
                I agree to the YourBarrio{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-purple-700 underline-offset-2 hover:underline"
                >
                  Terms of Service
                </Link>{" "}
                and acknowledge the{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-purple-700 underline-offset-2 hover:underline"
                >
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
            {legalAttempted && legalError ? (
              <p className="mt-2 text-xs leading-5 text-rose-600/90">{legalError}</p>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className={authErrorClassName}>
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className={`${authPrimaryButtonClassName} mt-2`}
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <div className="mt-4">
        <button
          type="button"
          onClick={handleGoogleSignup}
          disabled={loading}
          className={authGoogleButtonClassName}
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
          className={authSwitchLinkClassName}
        >
          Log in
        </button>
      </p>
    </BaseModal>
  );
}
