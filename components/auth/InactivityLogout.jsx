"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";

const DEFAULT_MINUTES = 30;
const THROTTLE_MS = 10_000;

export default function InactivityLogout() {
  const { authUser, user, loadingUser } = useAuth();
  const timeoutIdRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const lastResetRef = useRef(0);

  useEffect(() => {
    if (loadingUser) return;
    const isLoggedIn = Boolean(authUser?.id || user?.id);
    if (!isLoggedIn) return;

    const minutesValue = Number(
      process.env.NEXT_PUBLIC_INACTIVITY_LOGOUT_MINUTES || DEFAULT_MINUTES
    );
    const timeoutMs = Math.max(1, minutesValue) * 60 * 1000;

    const clearTimer = () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
    };

    const triggerLogout = () => {
      try {
        sessionStorage.setItem("yb_auto_logged_out", "1");
      } catch {}
      window.location.replace("/api/auth/logout");
    };

    const scheduleLogout = (delayMs) => {
      clearTimer();
      timeoutIdRef.current = setTimeout(triggerLogout, delayMs);
    };

    const recordActivity = () => {
      const now = Date.now();
      if (now - lastResetRef.current < THROTTLE_MS) return;
      lastResetRef.current = now;
      lastActivityRef.current = now;
      scheduleLogout(timeoutMs);
    };

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= timeoutMs) {
        triggerLogout();
        return;
      }
      scheduleLogout(timeoutMs - elapsed);
    };

    lastActivityRef.current = Date.now();
    scheduleLogout(timeoutMs);

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "pointerdown",
    ];

    events.forEach((event) => {
      window.addEventListener(event, recordActivity, { passive: true });
    });
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, recordActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibility);
      clearTimer();
    };
  }, [authUser?.id, user?.id, loadingUser]);

  return null;
}
