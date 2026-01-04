"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function AuthedError({ error, reset }) {
  const pathname = usePathname();

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[APP_ERROR]", {
      message: error?.message,
      stack: error?.stack,
      pathname,
    });
  }, [error, pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 text-white">
      <div className="max-w-md w-full space-y-4 text-center bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-white/70">
          {error?.message || "The page failed to load. Try reloading to continue."}
        </p>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => reset?.()}
            className="w-full py-3 rounded-xl font-semibold bg-white text-black hover:bg-white/90 transition"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-3 rounded-xl font-semibold border border-white/20 text-white hover:bg-white/10 transition"
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}
