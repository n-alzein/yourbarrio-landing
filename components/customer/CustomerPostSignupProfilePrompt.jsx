"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getCustomerProfileCompletion } from "@/lib/customer/profile-completion";

const PENDING_PREFIX = "yb_customer_profile_prompt_pending:";
const DISMISSED_PREFIX = "yb_customer_profile_prompt_dismissed:";

function getStorageKey(prefix, userId) {
  return `${prefix}${userId}`;
}

export function markCustomerProfilePromptPending(userId) {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.localStorage.setItem(getStorageKey(PENDING_PREFIX, userId), "1");
  } catch {
    // Local persistence is best effort only.
  }
}

export default function CustomerPostSignupProfilePrompt() {
  const { user, profile, refreshProfile } = useAuth();
  const [visible, setVisible] = useState(false);
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const userId = user?.id || "";
  const completion = useMemo(
    () => getCustomerProfileCompletion(profile),
    [profile]
  );

  useEffect(() => {
    if (!userId || completion.hasFullName) {
      setVisible(false);
      return;
    }

    try {
      const pending = window.localStorage.getItem(getStorageKey(PENDING_PREFIX, userId));
      const dismissed = window.localStorage.getItem(
        getStorageKey(DISMISSED_PREFIX, userId)
      );
      setVisible(pending === "1" && dismissed !== "1");
    } catch {
      setVisible(false);
    }
  }, [completion.hasFullName, userId]);

  const dismiss = () => {
    if (userId) {
      try {
        window.localStorage.setItem(getStorageKey(DISMISSED_PREFIX, userId), "1");
        window.localStorage.removeItem(getStorageKey(PENDING_PREFIX, userId));
      } catch {
        // Best effort.
      }
    }
    setVisible(false);
  };

  const saveName = async (event) => {
    event.preventDefault();
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setError("Enter your full name or skip for now.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/account/profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: trimmedName }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save your name.");
      }
      await refreshProfile?.();
      dismiss();
    } catch (err) {
      setError(err?.message || "Failed to save your name.");
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/40 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-profile-welcome-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <h2
          id="customer-profile-welcome-title"
          className="text-xl font-semibold tracking-tight text-slate-950"
        >
          Welcome to YourBarrio
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Add your name so local shops know who they’re helping.
        </p>

        <form onSubmit={saveName} className="mt-5 space-y-4">
          <div className="space-y-2">
            <label htmlFor="post-signup-full-name" className="text-sm font-medium text-slate-800">
              Full name
            </label>
            <input
              id="post-signup-full-name"
              type="text"
              value={fullName}
              onChange={(event) => {
                setFullName(event.target.value);
                setError("");
              }}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition placeholder:text-slate-400 focus-visible:border-violet-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-500/15"
              autoComplete="name"
              autoFocus
            />
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={dismiss}
              disabled={saving}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-500/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Skip for now
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-violet-600 px-4 text-sm font-medium text-white transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-500/20 disabled:cursor-not-allowed disabled:bg-violet-300"
            >
              {saving ? "Saving..." : "Save and continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
