"use client";

import { Suspense } from "react";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

function BusinessRegisterInner() {
  const router = useRouter();
  const { supabase, authUser, role, loadingUser } = useAuth();
  const searchParams = useSearchParams();
  const isPopup = searchParams?.get("popup") === "1";

  const [loading, setLoading] = useState(false);

  // Form fields
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const finishBusinessAuth = useCallback(() => {
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
            router.replace(target);
          }
        }, 150);

        return;
      }
    }

    router.replace(target);
  }, [isPopup, router]);

  /* --------------------------------------------------------------
     AUTO-REDIRECT IF ALREADY LOGGED IN
  -------------------------------------------------------------- */
  useEffect(() => {
    if (loadingUser) return;
    if (!authUser) return;
    if (!role) return; // wait until role is loaded

    if (role === "business") {
      finishBusinessAuth();
    } else {
      router.replace("/customer/home");
    }
  }, [authUser, role, loadingUser, router, finishBusinessAuth]);

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

    setLoading(false);
    finishBusinessAuth();
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
     UI — MATCHES LOGIN PAGE STYLING
  -------------------------------------------------------------- */
  return (
    <div className="min-h-screen flex items-center justify-center px-4 text-white">
      <div
        className="
          w-full max-w-md p-8 rounded-2xl
          auth-card backdrop-blur-xl
          border border-white/10
          shadow-[0_0_40px_-12px_rgba(0,0,0,0.4)]
          animate-fadeIn
        "
      >
        <h1 className="text-3xl font-extrabold text-center mb-3 tracking-tight">
          Create Business Account
        </h1>

        <p className="text-center text-white/70 mb-6">
          Start reaching local customers today
        </p>

        {/* ---------------- GOOGLE LOGIN ---------------- */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          className="
            w-full flex items-center justify-center gap-2
            py-3 rounded-xl font-semibold bg-white text-black
            hover:bg-white/90 active:scale-[0.98] transition-all
          "
        >
          <img src="/google-icon.svg" alt="" className="w-5 h-5" />
          Sign up with Google
        </button>

        <div className="my-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-white/40 text-sm">or</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* ---------------- FORM ---------------- */}
        <form onSubmit={handleRegister} className="space-y-4">

          <input
            type="text"
            placeholder="Business Name"
            className="
              w-full px-4 py-3 rounded-xl
              bg-black/30 border border-white/10 
              placeholder-white/40
              focus:ring-2 focus:ring-fuchsia-500/40 
              transition
            "
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required
          />

          <input
            type="email"
            placeholder="Email"
            className="
              w-full px-4 py-3 rounded-xl
              bg-black/30 border border-white/10 
              placeholder-white/40
              focus:ring-2 focus:ring-fuchsia-500/40 
              transition
            "
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            className="
              w-full px-4 py-3 rounded-xl
              bg-black/30 border border-white/10 
              placeholder-white/40
              focus:ring-2 focus:ring-fuchsia-500/40
              transition
            "
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="
              w-full py-3 rounded-xl font-semibold text-lg
              bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-500
              shadow-lg shadow-fuchsia-500/30
              hover:brightness-110 active:scale-[0.98]
              transition-all
            "
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        {/* ---------------- LOGIN LINK ---------------- */}
        <p className="text-center text-white/70 text-sm mt-4">
          Already have a business account?{" "}
          <a
            href="/business-auth/login"
            className="text-pink-400 font-medium hover:underline"
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
