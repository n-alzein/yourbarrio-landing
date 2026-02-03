"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const MIN_PASSWORD_LENGTH = 8;

function UpdatePasswordContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const [loadingSession, setLoadingSession] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const didExchangeRef = useRef(false);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowserClient();

    const finalize = (message, isError = false) => {
      if (!active) return;
      if (isError) {
        setErrorMessage(message);
      } else if (message) {
        setStatusMessage(message);
      }
      setLoadingSession(false);
    };

    const init = async () => {
      if (!supabase) {
        finalize("Unable to load authentication.", true);
        return;
      }

      if (errorParam) {
        finalize(errorDescription || "Invalid or expired recovery link.", true);
        return;
      }

      if (code && !didExchangeRef.current) {
        didExchangeRef.current = true;
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          finalize(error.message || "Unable to verify recovery link.", true);
          return;
        }
      }

      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        finalize("Recovery session not found. Request a new reset link.", true);
        return;
      }
      finalize("", false);
    };

    init();

    return () => {
      active = false;
    };
  }, [code, errorDescription, errorParam]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("");

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords must match.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setErrorMessage("Unable to load authentication.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setSaving(false);

    if (error) {
      setErrorMessage(error.message || "Failed to update password.");
      return;
    }

    setStatusMessage("Password updated. You can return to your account.");
  };

  return (
    <div className="min-h-screen bg-[#05010d] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
        <h1 className="text-2xl font-semibold">Update your password</h1>
        <p className="mt-2 text-sm text-white/60">
          Choose a new password for your account.
        </p>

        {loadingSession ? (
          <div className="mt-6 flex items-center gap-3 text-sm text-white/70">
            <div className="h-5 w-5 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
            Verifying your reset link...
          </div>
        ) : null}

        {!loadingSession && !errorMessage ? (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="new-password"
                className="block text-sm text-white/70 mb-1.5"
              >
                New password
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="h-11 w-full rounded-xl border border-white/15 bg-black/20 px-3 text-base md:text-sm text-white placeholder:text-white/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60 focus-visible:border-pink-400/60"
                placeholder={`Minimum ${MIN_PASSWORD_LENGTH} characters`}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label
                htmlFor="confirm-password"
                className="block text-sm text-white/70 mb-1.5"
              >
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="h-11 w-full rounded-xl border border-white/15 bg-black/20 px-3 text-base md:text-sm text-white placeholder:text-white/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60 focus-visible:border-pink-400/60"
                placeholder="Re-enter your new password"
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className={`inline-flex h-11 w-full items-center justify-center rounded-xl px-5 text-sm font-semibold transition ${
                saving
                  ? "cursor-not-allowed bg-white/20 text-white/40"
                  : "bg-white text-black hover:bg-gray-200"
              }`}
            >
              {saving ? "Updating..." : "Update password"}
            </button>
          </form>
        ) : null}

        {errorMessage ? (
          <div className="mt-6 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {errorMessage}
          </div>
        ) : null}

        {statusMessage ? (
          <div className="mt-6 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {statusMessage}
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-between text-sm text-white/60">
          <Link className="text-pink-300 hover:text-pink-200" href="/">
            Back to home
          </Link>
          <Link
            className="text-pink-300 hover:text-pink-200"
            href="/auth/reset-password"
          >
            Send another reset link
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#05010d] text-white flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
            <div className="h-6 w-48 rounded bg-white/10 animate-pulse" />
            <div className="mt-3 h-4 w-56 rounded bg-white/10 animate-pulse" />
            <div className="mt-6 flex items-center gap-3 text-sm text-white/70">
              <div className="h-5 w-5 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
              Verifying your reset link...
            </div>
          </div>
        </div>
      }
    >
      <UpdatePasswordContent />
    </Suspense>
  );
}
