"use client";

import { useEffect, useRef } from "react";
import { appendCrashLog } from "@/lib/crashlog";
import {
  reportClientError,
  shouldSendGlobalClientErrorDiagnostics,
} from "@/lib/clientErrorDiagnostics";
import { usePathname } from "next/navigation";

export default function CrashLoggerClient() {
  const mountedRef = useRef(false);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (mountedRef.current) return undefined;
    mountedRef.current = true;
    const sendRemoteDiagnostics = shouldSendGlobalClientErrorDiagnostics();

    const handleError = (event) => {
      try {
        appendCrashLog({
          kind: "error",
          message: event?.message || "Unknown error",
          filename: event?.filename,
          lineno: event?.lineno,
          colno: event?.colno,
          stack: event?.error?.stack,
        });
        if (sendRemoteDiagnostics) {
          reportClientError({
            error: event?.error || event?.message || "Unknown browser error",
            source: "window-error",
            pathname: window.location?.pathname || pathname || "",
          });
        }
      } catch {
        /* no-op */
      }
    };

    const handleRejection = (event) => {
      try {
        appendCrashLog({
          kind: "unhandledrejection",
          reason: event?.reason,
        });
        if (sendRemoteDiagnostics) {
          reportClientError({
            error: event?.reason || "Unhandled promise rejection",
            source: "unhandledrejection",
            pathname: window.location?.pathname || pathname || "",
          });
        }
      } catch {
        /* no-op */
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    appendCrashLog({
      type: "navigation",
      path: pathname || window.location?.pathname,
      referrer: document.referrer || undefined,
    });
  }, [pathname]);

  return null;
}
