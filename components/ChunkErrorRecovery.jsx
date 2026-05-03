"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  clearChunkRecoveryGuard,
  hasChunkRecoveryGuard,
  isChunkLoadError,
  markChunkRecoveryAttempted,
} from "@/lib/chunkErrorRecovery";

function getSessionStorage() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

function recoverFromChunkError(error) {
  if (typeof window === "undefined") return "retry";
  const storage = getSessionStorage();
  if (!isChunkLoadError(error)) return "ignore";
  if (hasChunkRecoveryGuard(storage)) return "failed";

  markChunkRecoveryAttempted(storage);
  window.setTimeout(() => {
    window.location.reload();
  }, 80);
  return "refreshing";
}

export function ChunkRecoveryFallback({
  mode = "refreshing",
  title = "Refreshing YourBarrio...",
  message = "Updating your session...",
}) {
  const isFailed = mode === "failed";
  return (
    <div
      style={{
        alignItems: "center",
        background: "#f8fafc",
        color: "#172033",
        display: "flex",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "24px",
        width: "100%",
      }}
    >
      <style>{`
        @keyframes yb-chunk-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #dbe3ee",
          borderRadius: "18px",
          boxShadow: "0 24px 80px rgba(15, 23, 42, 0.12)",
          maxWidth: "448px",
          padding: "28px",
          textAlign: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            height: "56px",
            justifyContent: "center",
            margin: "0 auto 20px",
            width: "56px",
          }}
        >
          <img
            src="/YBpin.png"
            alt="YourBarrio"
            style={{
              display: "block",
              height: "56px",
              objectFit: "contain",
              width: "56px",
            }}
          />
        </div>
        <h1
          style={{
            fontSize: "20px",
            fontWeight: 650,
            letterSpacing: 0,
            lineHeight: 1.25,
            margin: 0,
          }}
        >
          {isFailed ? "We need one more refresh" : title}
        </h1>
        <p
          style={{
            color: "#526070",
            fontSize: "14px",
            lineHeight: "24px",
            margin: "8px 0 0",
          }}
        >
          {isFailed
            ? "Your session is safe, but this page could not load the latest app files."
            : message}
        </p>
        {isFailed ? (
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: "#172033",
              border: 0,
              borderRadius: "12px",
              color: "#ffffff",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 650,
              marginTop: "20px",
              padding: "12px 16px",
              width: "100%",
            }}
          >
            Refresh page
          </button>
        ) : (
          <div
            aria-hidden="true"
            style={{
              animation: "yb-chunk-spin 0.8s linear infinite",
              border: "4px solid #e4e9f2",
              borderRadius: "999px",
              borderTopColor: "#6f34ff",
              height: "32px",
              margin: "20px auto 0",
              width: "32px",
            }}
          />
        )}
      </div>
    </div>
  );
}

export function ChunkErrorRecoveryListener() {
  const [recoveryState, setRecoveryState] = useState(null);
  const pathname = usePathname();

  useEffect(() => {
    const handleChunkError = (error) => {
      const result = recoverFromChunkError(error);
      if (result === "refreshing" || result === "failed") {
        setRecoveryState(result);
        return true;
      }
      return false;
    };

    const onError = (event) => {
      if (handleChunkError(event?.error || event)) {
        event?.preventDefault?.();
      }
    };
    const onUnhandledRejection = (event) => {
      if (handleChunkError(event?.reason || event)) {
        event?.preventDefault?.();
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    if (recoveryState) return undefined;
    const id = window.setTimeout(() => {
      clearChunkRecoveryGuard(getSessionStorage());
    }, 2500);
    return () => window.clearTimeout(id);
  }, [pathname, recoveryState]);

  if (!recoveryState) return null;
  return (
    <div className="fixed inset-0 z-[2147483647]">
      <ChunkRecoveryFallback mode={recoveryState} />
    </div>
  );
}

export class ChunkErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { recoveryState: null };
  }

  static getDerivedStateFromError(error) {
    if (!isChunkLoadError(error)) return { nonChunkError: error };
    return {
      recoveryState: hasChunkRecoveryGuard(getSessionStorage())
        ? "failed"
        : "refreshing",
    };
  }

  componentDidCatch(error, info) {
    if (!isChunkLoadError(error)) {
      console.error("[APP_ERROR_BOUNDARY]", error, info);
      return;
    }
    console.warn("[CHUNK_RECOVERY]", {
      message: error?.message,
      stack: error?.stack,
      componentStack: info?.componentStack,
      state: this.state.recoveryState,
    });
    recoverFromChunkError(error);
  }

  render() {
    if (this.state.nonChunkError) {
      throw this.state.nonChunkError;
    }
    if (this.state.recoveryState) {
      return <ChunkRecoveryFallback mode={this.state.recoveryState} />;
    }
    return this.props.children;
  }
}
