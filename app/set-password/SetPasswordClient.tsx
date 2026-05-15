"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

const MIN_PASSWORD_LENGTH = 8;

export default function SetPasswordClient() {
  const searchParams = useSearchParams();
  const tokenHash = searchParams.get("token_hash") || searchParams.get("hashed_token") || "";
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMessage("Passwords must match.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          password,
          password_confirm: passwordConfirm,
          token_hash: tokenHash || undefined,
          type: "recovery",
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        if (payload?.error === "invalid_or_expired_link") {
          setErrorMessage("Link is invalid or expired. Request a new reset link.");
        } else if (payload?.error === "update_failed") {
          setErrorMessage("We couldn't update your password. Please try again.");
        } else {
          setErrorMessage("Unable to update password. Please try again.");
        }
        setSubmitting(false);
        return;
      }

      const redirectTo =
        typeof payload?.redirectTo === "string" && payload.redirectTo.startsWith("/")
          ? payload.redirectTo
          : "/login?reset=success";
      window.location.assign(redirectTo);
    } catch {
      setErrorMessage("Unable to update password. Please try again.");
      setSubmitting(false);
    }
  }

  const errorParam = searchParams.get("error") || "";
  const pageError =
    errorParam === "invalid_or_expired" || errorParam === "invalid_or_expired_link"
      ? "Link is invalid or expired. Request a new reset link."
      : "";

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900">
      <main className="flex min-h-screen w-full items-center justify-center px-4 py-12">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-slate-900">Set your password</h1>
            <p className="text-sm text-slate-600">Enter a new password for your account.</p>
          </div>

          <form className="mt-12" onSubmit={handleSubmit}>
            <div>
              <div className="space-y-2">
                <label htmlFor="new-password" className="block text-sm text-slate-700">
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  placeholder={`Minimum ${MIN_PASSWORD_LENGTH} characters`}
                  autoComplete="new-password"
                />
              </div>

              <div className="mt-7 space-y-2">
                <label htmlFor="confirm-password" className="block text-sm text-slate-700">
                  Repeat new password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  placeholder="Re-enter your new password"
                  autoComplete="new-password"
                />
                <p className="pt-1 text-sm text-slate-500">Use at least 8 characters.</p>
              </div>
            </div>

            {pageError || errorMessage ? (
              <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage || pageError}
              </div>
            ) : null}

            <div className="mt-10 flex flex-col gap-4">
              <button
                type="submit"
                disabled={submitting}
                className="yb-primary-button inline-flex h-12 w-full items-center justify-center rounded-xl px-5 text-sm font-semibold !text-white"
              >
                {submitting ? "Updating..." : "Update password"}
              </button>

              <Link
                href="/auth/forgot-password"
                className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Request a new reset link
              </Link>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
