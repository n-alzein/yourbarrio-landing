"use client";

import { useEffect } from "react";
import AppErrorFallback from "@/components/AppErrorFallback";
import { ChunkRecoveryFallback } from "@/components/ChunkErrorRecovery";
import { reportClientError } from "@/lib/clientErrorDiagnostics";
import {
  getChunkErrorDiagnostics,
  hasChunkRecoveryGuard,
  isChunkLoadError,
  markChunkRecoveryAttempted,
} from "@/lib/chunkErrorRecovery";

function shouldLogChunkDiagnostics() {
  if (process.env.NEXT_PUBLIC_CHUNK_RECOVERY_DEBUG === "1") return true;
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage?.getItem("CHUNK_RECOVERY_DEBUG") === "1";
  } catch {
    return false;
  }
}

export default function GlobalError({ error, reset }) {
  const isChunkError = isChunkLoadError(error);
  const alreadyRecovered =
    typeof window !== "undefined" && hasChunkRecoveryGuard(window.sessionStorage);

  useEffect(() => {
    const pathname =
      typeof window !== "undefined" ? window.location.pathname : "";
    reportClientError({ error, source: "app-error", pathname });
    if (shouldLogChunkDiagnostics()) {
      console.error("[PUBLIC_ERROR]", {
        message: error?.message,
        stack: error?.stack,
        pathname,
      });
      console.warn("[CHUNK_RECOVERY_DIAG]", {
        source: "app-error",
        result: isChunkError ? (alreadyRecovered ? "failed" : "refreshing") : "ignore",
        ...getChunkErrorDiagnostics(error, pathname),
      });
    }
  }, [alreadyRecovered, error, isChunkError]);

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

  return <AppErrorFallback reset={reset} />;
}
