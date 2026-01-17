"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { logDataDiag } from "@/lib/dataDiagnostics";

const defaultLoading = (
  <div className="min-h-screen bg-black text-white flex items-center justify-center">
    <div className="text-center space-y-3">
      <div className="h-12 w-12 rounded-full border-4 border-white/10 border-t-white/70 animate-spin mx-auto" />
      <p className="text-lg text-white/70">Loading your account...</p>
    </div>
  </div>
);

export default function RequireSessionGate({ children, fallback }) {
  const { authUser, loadingUser } = useAuth();
  const redirectedRef = useRef(false);

  useEffect(() => {
    logDataDiag("session", {
      loading: loadingUser,
      authed: Boolean(authUser),
      hasUser: Boolean(authUser),
      error: null,
    });
  }, [authUser, loadingUser]);

  useEffect(() => {
    if (loadingUser || authUser) return;
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    if (typeof window !== "undefined") {
      window.location.replace("/");
    }
  }, [authUser, loadingUser]);

  if (loadingUser || !authUser) {
    return fallback || defaultLoading;
  }

  return <>{children}</>;
}
