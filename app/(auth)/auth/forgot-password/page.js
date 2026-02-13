"use client";

import { useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

function resolveResetRedirectTo() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || "";
  if (configured) {
    try {
      return new URL("/auth/update-password", configured).toString();
    } catch {
      // Ignore malformed env value and fall back to current origin.
    }
  }

  if (typeof window === "undefined") return "/auth/update-password";
  return `${window.location.origin}/auth/update-password`;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setInfoMessage("");

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setErrorMessage("Enter a valid email address.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setErrorMessage("Unable to load authentication.");
      return;
    }

    setSubmitting(true);
    try {
      await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: resolveResetRedirectTo(),
      });
      setInfoMessage("If an account exists, we sent a reset link.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05010d] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
        <h1 className="text-2xl font-semibold">Forgot your password?</h1>
        <p className="mt-2 text-sm text-white/60">Enter your email and we will send a reset link.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="reset-email" className="mb-1.5 block text-sm text-white/70">
              Email address
            </label>
            <input
              id="reset-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 w-full rounded-xl border border-white/15 bg-black/20 px-3 text-base text-white placeholder:text-white/40 transition focus-visible:border-pink-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60 md:text-sm"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`inline-flex h-11 w-full items-center justify-center rounded-xl px-5 text-sm font-semibold transition ${
              submitting ? "cursor-not-allowed bg-white/20 text-white/40" : "bg-white text-black hover:bg-gray-200"
            }`}
          >
            {submitting ? "Sending..." : "Send reset link"}
          </button>
        </form>

        {errorMessage ? (
          <div className="mt-4 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {errorMessage}
          </div>
        ) : null}

        {infoMessage ? (
          <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {infoMessage}
          </div>
        ) : null}

        <div className="mt-6 text-sm text-white/60">
          <Link className="text-pink-300 hover:text-pink-200" href="/">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
