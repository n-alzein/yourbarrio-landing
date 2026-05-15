"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const CONSENT_ERROR =
  "You need to accept the Terms of Service and acknowledge the Privacy Policy before creating your account.";

function normalizeNextPath(value) {
  if (typeof value !== "string") return "/customer/home";
  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/customer/home";
  }
  if (trimmed.startsWith("/api/") || trimmed.startsWith("/_next/")) {
    return "/customer/home";
  }
  return trimmed;
}

export default function CustomerLegalCompletionClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accepted, setAccepted] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const nextPath = useMemo(
    () => normalizeNextPath(searchParams?.get("next")),
    [searchParams]
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setAttemptedSubmit(true);
    setError("");

    if (!accepted) {
      setError(CONSENT_ERROR);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/account/legal-acceptances", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_terms_accepted: true,
          source: "oauth_completion",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.error || "Could not complete your account. Please try again.");
        return;
      }
      router.replace(nextPath);
    } catch (err) {
      console.error("Customer legal completion failed", err);
      setError("Could not complete your account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-950">
      <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-600">
          YourBarrio policies
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
          Complete your account
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Before continuing, please accept the Terms of Service and acknowledge
          the Privacy Policy.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-700">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => {
                  setAccepted(event.target.checked);
                  if (event.target.checked) setError("");
                }}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-2 focus:ring-purple-500/40"
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
            {attemptedSubmit && error ? (
              <p className="mt-3 text-sm text-red-600">{error}</p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="yb-primary-button w-full rounded-xl py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Completing account..." : "Continue"}
          </button>
        </form>
      </section>
    </main>
  );
}
