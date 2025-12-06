"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export default function RegisterPage({ isBusiness: forcedBusinessMode }) {
  const router = useRouter();
  const { supabase } = useAuth();

  /* ============================================================
     BUSINESS MODE CONTROL
  ============================================================ */
  const [businessMode, setBusinessMode] = useState(
    forcedBusinessMode || false
  );

  useEffect(() => {
    if (forcedBusinessMode) {
      sessionStorage.setItem("businessNavMode", "1");
      setBusinessMode(true);
    } else {
      sessionStorage.removeItem("businessNavMode");
      setBusinessMode(false);
    }
  }, [forcedBusinessMode]);

  /* ============================================================
     HOOKS
  ============================================================ */
  const [hydrated, setHydrated] = useState(false);
  const [checkingUser, setCheckingUser] = useState(true);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  /* 1️⃣ Hydration guard */
  useEffect(() => {
    setHydrated(true);
  }, []);

  /* 2️⃣ Redirect if logged in */
  useEffect(() => {
    if (!hydrated) return;

    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const { data: profile } = await supabase
          .from("users")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();

        const dest =
          profile?.role === "business"
            ? "/business/dashboard"
            : "/customer/home";

        window.location.href = dest;
      } else {
        setCheckingUser(false);
      }
    }

    checkUser();
  }, [hydrated, supabase]);

  if (!hydrated || checkingUser) {
    return <div className="h-screen" />;
  }

  /* ============================================================
     EMAIL + PASSWORD SIGNUP
  ============================================================ */
  async function handleRegister(e) {
    e.preventDefault();
    setLoading(true);

    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const authUser = signUpData?.user;
    if (!authUser) {
      alert("Signup succeeded but no user returned. Try logging in.");
      setLoading(false);
      return;
    }

    const finalRole = businessMode ? "business" : "customer";

    const { error: insertError } = await supabase.from("users").insert({
      id: authUser.id,
      email: authUser.email,
      role: finalRole,
      full_name: "",
    });

    if (insertError) {
      alert("Failed to create profile row.");
      setLoading(false);
      return;
    }

    if (finalRole === "business") {
      sessionStorage.setItem("businessNavMode", "1");
    } else {
      sessionStorage.removeItem("businessNavMode");
    }

    const dest =
      finalRole === "business"
        ? "/business/dashboard"
        : "/customer/home";

    window.location.href = dest;
  }

  /* ============================================================
     GOOGLE SIGNUP
  ============================================================ */
  async function handleGoogleSignup() {
    setLoading(true);

    const origin =
      typeof window !== "undefined" ? window.location.origin : "";

    const redirectTo = businessMode
      ? `${origin}/business/dashboard`
      : `${origin}/customer/home`;

    // Supabase will auto-create user in auth.users
    // AuthProvider will auto-create row in public.users
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) {
      console.error(error);
      alert("Failed to continue with Google.");
      setLoading(false);
      return;
    }
  }

  /* ============================================================
     UI
  ============================================================ */
  return (
    <div className="min-h-screen flex flex-col">
      <div className="w-full flex justify-center px-4 mt-24 grow text-white">
        <div
          className="
          max-w-md w-full max-h-[420px]
          p-8 rounded-2xl bg-black/25 backdrop-blur-xl border border-white/10
          overflow-y-auto shadow-[0_0_60px_-12px_rgba(0,0,0,0.4)]
          animate-fadeIn
        "
        >
          <h1 className="text-3xl font-extrabold text-center mb-3 tracking-tight">
            {businessMode ? "Create Business Account" : "Create Account"}
          </h1>

          <p className="text-center text-white/70 mb-6">
            {businessMode
              ? "Register your business in seconds"
              : "Join YourBarrio instantly"}
          </p>

          {/* --- EMAIL SIGNUP FORM --- */}
          <form onSubmit={handleRegister} className="space-y-4">
            <input
              type="email"
              placeholder={businessMode ? "Business Email" : "Email"}
              className="
                w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10
                text-white placeholder-white/50 focus:ring-2
                focus:ring-purple-500/40 focus:border-purple-400
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
                w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10
                text-white placeholder-white/50 focus:ring-2
                focus:ring-purple-500/40 focus:border-purple-400
                transition
              "
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button
              type="submit"
              disabled={loading}
              className={`
                w-full py-3 rounded-xl font-semibold text-white text-lg
                bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-500
                shadow-lg hover:brightness-110 active:scale-[0.97]
                transition-all duration-200
                ${loading ? "opacity-60 cursor-not-allowed" : ""}
              `}
            >
              {loading ? "Creating..." : "Create Account"}
            </button>
          </form>

          {/* --- GOOGLE SIGNUP BUTTON --- */}
          <button
            type="button"
            onClick={handleGoogleSignup}
            className="
              w-full mt-5 py-3 rounded-xl font-medium
              bg-white/10 border border-white/20
              hover:bg-white/20
              flex items-center justify-center gap-2
              transition
            "
          >
            <img src="/google-icon.svg" className="h-5 w-5" />
            Continue with Google
          </button>

          {/* --- ALREADY HAVE ACCOUNT? --- */}
          <p className="text-center text-white/70 text-sm mt-4">
            Already have an account?{" "}
            <Link
              href={businessMode ? "/business/login" : "/auth/login"}
              className="text-pink-400 font-medium hover:underline"
            >
              Log in
            </Link>
          </p>
        </div>

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
    </div>
  );
}
