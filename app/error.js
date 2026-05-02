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
    console.error("[PUBLIC_ERROR]", {
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
      <ChunkRecoveryFallback
        mode={alreadyRecovered ? "failed" : "refreshing"}
        title="Refreshing YourBarrio..."
        message="Updating your session..."
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#172033] flex items-center justify-center px-6">
      <div className="max-w-md w-full space-y-4 text-center bg-white border border-[#dbe3ee] rounded-2xl p-6 shadow-xl">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-[#526070]">
          {error?.message || "The app hit a snag. Try reloading to continue."}
        </p>
        <button
          type="button"
          onClick={() => reset?.()}
          className="w-full py-3 rounded-xl font-semibold bg-[#172033] text-white hover:bg-[#243047] transition"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
