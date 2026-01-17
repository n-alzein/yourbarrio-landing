"use client";

import { Suspense } from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getCookieName } from "@/lib/supabaseClient";

function BusinessRegisterInner() {
  const { supabase, authUser, role, loadingUser } = useAuth();
  const searchParams = useSearchParams();
  const isPopup = searchParams?.get("popup") === "1";

  const [loading, setLoading] = useState(false);
  const redirectingRef = useRef(false);

  // Form fields
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

    const target = "/business/onboarding";

    if (typeof window !== "undefined") {
      try {
        // Notify opener tab that business auth succeeded and where to send them
        localStorage.setItem("business_auth_redirect", target);
        localStorage.setItem("business_auth_success", Date.now().toString());
      } catch (err) {
        console.warn("Could not broadcast business auth success", err);
      }

      if (isPopup) {
        // Close popup when possible; fall back to in-tab redirect if blocked
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

  /* --------------------------------------------------------------
     AUTO-REDIRECT IF ALREADY LOGGED IN
  -------------------------------------------------------------- */
  useEffect(() => {
    if (loadingUser) return;
    if (!authUser) return;
    if (!role) return; // wait until role is loaded

    if (role === "business") {
      redirectToOnboarding();
    } else {
      window.location.replace("/customer/home");
    }
  }, [authUser, role, loadingUser, redirectToOnboarding]);

  /* --------------------------------------------------------------
     EMAIL/PASSWORD BUSINESS SIGNUP
  -------------------------------------------------------------- */
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
    if (!user) {
      alert("Sign up failed. Try again.");
      setLoading(false);
      return;
    }

    // Create business profile
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

    await redirectToOnboarding();
    setLoading(false);
  }

  /* --------------------------------------------------------------
     GOOGLE OAUTH SIGN-IN
  -------------------------------------------------------------- */
  async function handleGoogle() {
    setLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/oauth/callback`,
      },
    });

    if (error) {
      alert(error.message);
    }

    setLoading(false);
  }

  /* --------------------------------------------------------------
     LOADING GUARD
  -------------------------------------------------------------- */
  if (loadingUser) {
    return <div className="min-h-screen bg-black" />;
    }

  /* --------------------------------------------------------------
     UI — PROFESSIONAL BUSINESS STYLE
  -------------------------------------------------------------- */
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div
        className="w-full max-w-md p-8 rounded-2xl backdrop-blur-xl animate-fadeIn"
        style={{
          background: 'rgba(30, 41, 59, 0.4)',
          border: '1px solid rgba(51, 65, 85, 0.5)',
          boxShadow: '0 0 40px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        <h1 className="text-3xl font-extrabold text-center mb-3 tracking-tight" style={{ color: '#fff' }}>
          Create Business Account
        </h1>

        <p className="text-center mb-6" style={{ color: '#94a3b8' }}>
          Start reaching local customers today
        </p>

        {/* ---------------- GOOGLE LOGIN ---------------- */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold active:scale-[0.98] transition-all"
          style={{ background: '#fff', color: '#000' }}
        >
          <img src="/google-icon.svg" alt="" className="w-5 h-5" />
          Sign up with Google
        </button>

        <div className="my-6 flex items-center gap-4">
          <div className="h-px flex-1" style={{ background: 'rgba(71, 85, 105, 0.3)' }} />
          <span className="text-sm" style={{ color: '#64748b' }}>or</span>
          <div className="h-px flex-1" style={{ background: 'rgba(71, 85, 105, 0.3)' }} />
        </div>

        {/* ---------------- FORM ---------------- */}
        <form onSubmit={handleRegister} className="space-y-4">
          <input
            id="business-register-name"
            name="businessName"
            type="text"
            placeholder="Business Name"
            className="w-full px-4 py-3 rounded-xl transition focus:outline-none focus:ring-2"
            style={{
              background: 'rgba(30, 41, 59, 0.5)',
              border: '1px solid rgba(71, 85, 105, 0.3)',
              color: '#fff',
            }}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required
          />

          <input
            id="business-register-email"
            name="email"
            type="email"
            placeholder="Email"
            className="w-full px-4 py-3 rounded-xl transition focus:outline-none focus:ring-2"
            style={{
              background: 'rgba(30, 41, 59, 0.5)',
              border: '1px solid rgba(71, 85, 105, 0.3)',
              color: '#fff',
            }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            id="business-register-password"
            name="password"
            type="password"
            placeholder="Password"
            className="w-full px-4 py-3 rounded-xl transition focus:outline-none focus:ring-2"
            style={{
              background: 'rgba(30, 41, 59, 0.5)',
              border: '1px solid rgba(71, 85, 105, 0.3)',
              color: '#fff',
            }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-lg active:scale-[0.98] transition-all duration-200"
            style={{
              background: '#2563eb',
              color: '#fff',
              boxShadow: '0 10px 15px -3px rgba(30, 58, 138, 0.3)',
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        {/* ---------------- LOGIN LINK ---------------- */}
        <p className="text-center text-sm mt-4" style={{ color: '#94a3b8' }}>
          Already have a business account?{" "}
          <a
            href="/business-auth/login"
            className="font-medium hover:underline"
            style={{ color: '#60a5fa' }}
          >
            Log in
          </a>
        </p>
      </div>

      {/* Fade animation */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out;
        }
        .business-auth-page input::placeholder {
          color: #94a3b8;
        }
        .business-auth-page input:focus {
          border-color: rgba(59, 130, 246, 0.5);
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
        }
        .business-auth-page button:hover:not(:disabled) {
          filter: brightness(1.1);
        }
      `}</style>
    </div>
  );
}

/* --------------------------------------------------------------
   EXPORT WRAPPER
-------------------------------------------------------------- */
export default function BusinessRegisterPage() {
  return (
    <Suspense fallback={null}>
      <BusinessRegisterInner />
    </Suspense>
  );
}
