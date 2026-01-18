"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    const pathname =
      typeof window !== "undefined" ? window.location.pathname : "";
    console.error("[PUBLIC_ERROR]", {
      message: error?.message,
      stack: error?.stack,
      pathname,
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="max-w-md w-full space-y-4 text-center bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-white/70">
            {error?.message || "The app hit a snag. Try reloading to continue."}
          </p>
          <button
            type="button"
            onClick={() => reset?.()}
            className="w-full py-3 rounded-xl font-semibold bg-white text-black hover:bg-white/90 transition"
          >
            Retry
          </button>
        </div>
      </body>
    </html>
  );
}
