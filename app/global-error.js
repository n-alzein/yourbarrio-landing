"use client";

import { useEffect } from "react";
import { ChunkRecoveryFallback } from "@/components/ChunkErrorRecovery";
import {
  hasChunkRecoveryGuard,
  isChunkLoadError,
  markChunkRecoveryAttempted,
} from "@/lib/chunkErrorRecovery";

export default function GlobalError({ error, reset }) {
  const isChunkError = isChunkLoadError(error);
  const alreadyRecovered =
    typeof window !== "undefined" && hasChunkRecoveryGuard(window.sessionStorage);

  useEffect(() => {
    const pathname =
      typeof window !== "undefined" ? window.location.pathname : "";
    console.error("[GLOBAL_ERROR]", {
      message: error?.message,
      stack: error?.stack,
      pathname,
    });
  }, [error]);

  useEffect(() => {
    if (!isChunkError || alreadyRecovered || typeof window === "undefined") return;
    markChunkRecoveryAttempted(window.sessionStorage);
    const id = window.setTimeout(() => window.location.reload(), 80);
    return () => window.clearTimeout(id);
  }, [alreadyRecovered, isChunkError]);

  if (isChunkError) {
    return (
      <html lang="en">
        <body>
          <ChunkRecoveryFallback
            mode={alreadyRecovered ? "failed" : "refreshing"}
            title="Refreshing YourBarrio..."
            message="Updating your session..."
          />
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f8fafc] text-[#172033] flex items-center justify-center px-6">
        <div className="max-w-md w-full space-y-4 text-center bg-white border border-[#dbe3ee] rounded-2xl p-6 shadow-xl">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-[#526070]">
            {error?.message || "The app hit a snag. Try reloading to continue."}
          </p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => reset?.()}
              className="w-full py-3 rounded-xl font-semibold bg-[#172033] text-white hover:bg-[#243047] transition"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-3 rounded-xl font-semibold border border-[#cbd5e1] text-[#172033] hover:bg-[#f1f5f9] transition"
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
