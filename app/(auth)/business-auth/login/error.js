"use client";

import { useEffect } from "react";

export default function BusinessLoginError({ error, reset }) {
  const authDiagEnabled = process.env.NEXT_PUBLIC_AUTH_DIAG === "1";

  useEffect(() => {
    if (!authDiagEnabled) return;
    console.error("[AUTH_DIAG] business login error boundary", error);
  }, [authDiagEnabled, error]);

  return (
    <div className="min-h-screen flex items-center justify-center text-center px-6">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-6 text-white">
        <div className="text-lg font-semibold">We hit a snag</div>
        <div className="text-sm text-white/70 mt-1">
          Please try signing in again.
        </div>
        {authDiagEnabled && error?.message ? (
          <div className="mt-3 text-xs text-white/60 break-words">
            {error.message}
          </div>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="mt-4 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
