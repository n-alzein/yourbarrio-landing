"use client";

import { Suspense } from "react";
import { useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getCookieName } from "@/lib/supabaseClient";
import { PATHS } from "@/lib/auth/paths";

function BusinessRegisterInner() {
  const { supabase } = useAuth();
  const searchParams = useSearchParams();
  const isPopup = searchParams?.get("popup") === "1";

  const [loading, setLoading] = useState(false);
  const redirectingRef = useRef(false);
  const sessionRef = useRef(null);

  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const waitForAuthCookie = useCallback(async (timeoutMs = 2500) => {
    if (typeof document === "undefined") return false;
    const cookieName = getCookieName();
    if (!cookieName) return false;

    const hasAuthCookie = () => {
      const names = document.cookie
        .split(";")
        .map((entry) => entry.trim().split("=")[0])
        .filter(Boolean);
      return names.some(
        (name) => name === cookieName || name.startsWith(`${cookieName}.`)
      );
    };

    if (hasAuthCookie()) return true;

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (hasAuthCookie()) return true;
    }

    return false;
  }, []);

  const finishBusinessAuth = useCallback(() => {
    if (redirectingRef.current) return;
    redirectingRef.current = true;

    const target = PATHS.business.onboarding || "/business/onboarding";

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("business_auth_redirect", target);
        localStorage.setItem("business_auth_success", Date.now().toString());
      } catch (err) {
        console.warn("Could not broadcast business auth success", err);
      }

      if (isPopup) {
        window.close();

        setTimeout(() => {
          if (!window.closed) {
            window.location.replace(target);
          }
        }, 150);

        return;
      }
    }

    window.location.replace(target);
  }, [isPopup]);

  const redirectToOnboarding = useCallback(async () => {
    if (redirectingRef.current) return;
    await waitForAuthCookie();
    finishBusinessAuth();
  }, [finishBusinessAuth, waitForAuthCookie]);

  async function handleRegister(e) {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: businessName,
        },
      },
    });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const user = data.user;
    sessionRef.current = data?.session ?? null;
    if (!user) {
      alert("Sign up failed. Try again.");
      setLoading(false);
      return;
    }

    const profilePayload = {
      id: user.id,
      role: "business",
      email,
      full_name: businessName,
      business_name: businessName,
      category: "",
      description: "",
      website: "",
      address: "",
      city: "",
      profile_photo_url: "",
    };

    const { error: insertError } = await supabase
      .from("users")
      .insert(profilePayload);

    if (insertError) {
      console.error("Profile insert error:", insertError);
      alert("Failed to create business profile.");
      setLoading(false);
      return;
    }

    const session = sessionRef.current;
    if (session?.access_token && session?.refresh_token) {
      await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        }),
      });
    }

    await redirectToOnboarding();
    setLoading(false);
  }

  async function handleGoogle() {
    setLoading(true);

    const origin =
      typeof window !== "undefined" ? window.location.origin : "";

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/api/auth/callback`,
      },
    });

    if (error) {
      alert(error.message);
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div
        className="w-full max-w-md p-8 rounded-2xl backdrop-blur-xl animate-fadeIn"
        style={{
          background: "rgba(30, 41, 59, 0.4)",
          border: "1px solid rgba(51, 65, 85, 0.5)",
          boxShadow: "0 0 40px -12px rgba(0, 0, 0, 0.5)",
        }}
      >
        <h1
          className="text-3xl font-extrabold text-center mb-3 tracking-tight"
          style={{ color: "#fff" }}
        >
          Create Business Account
        </h1>

        <p className="text-center mb-6" style={{ color: "#94a3b8" }}>
          Start reaching local customers today
        </p>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold active:scale-[0.98] transition-all"
          style={{ background: "#fff", color: "#000" }}
        >
          <img src="/google-icon.svg" alt="" className="w-5 h-5" />
          Sign up with Google
        </button>

        <div className="my-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs text-white/50">or</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <input
            type="text"
            placeholder="Business name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white"
            required
          />

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white"
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold bg-indigo-500 text-white hover:bg-indigo-400 transition"
          >
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function BusinessRegisterClient() {
  return (
    <Suspense fallback={<div className="w-full max-w-2xl min-h-[420px]" />}>
      <BusinessRegisterInner />
    </Suspense>
  );
}
