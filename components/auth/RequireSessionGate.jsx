"use client";

import { useEffect, useRef, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient";
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
  const [state, setState] = useState(() => ({
    loading: true,
    authed: false,
    user: null,
    error: null,
  }));
  const redirectedRef = useRef(false);

  const setSnapshot = (next) => {
    setState(next);
    logDataDiag("session", {
      loading: next.loading,
      authed: next.authed,
      hasUser: Boolean(next.user),
      error: next.error ? String(next.error) : null,
    });
  };

  useEffect(() => {
    const client = getBrowserSupabaseClient();
    if (!client) {
      setSnapshot({
        loading: false,
        authed: false,
        user: null,
        error: "no-supabase-client",
      });
      return undefined;
    }

    let active = true;

    const syncSession = async () => {
      try {
        const { data, error } = await client.auth.getSession();
        if (!active) return;
        if (error) {
          setSnapshot({
            loading: false,
            authed: false,
            user: null,
            error: error?.message || String(error),
          });
          return;
        }
        const user = data?.session?.user ?? null;
        setSnapshot({
          loading: false,
          authed: Boolean(user),
          user,
          error: null,
        });
      } catch (err) {
        if (!active) return;
        setSnapshot({
          loading: false,
          authed: false,
          user: null,
          error: err?.message || String(err),
        });
      }
    };

    syncSession();

    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      const user = session?.user ?? null;
      setSnapshot({
        loading: false,
        authed: Boolean(user),
        user,
        error: null,
      });
      logDataDiag("session:event", { event, authed: Boolean(user) });
    });

    return () => {
      active = false;
      data?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (state.loading || state.authed) return;
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    if (typeof window !== "undefined") {
      window.location.replace("/");
    }
  }, [state.loading, state.authed]);

  if (state.loading || !state.authed) {
    return fallback || defaultLoading;
  }

  return <>{children}</>;
}
