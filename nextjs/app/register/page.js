"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export default function RegisterPage({ isBusiness: forcedBusinessMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { supabase } = useAuth();

  /* ============================================================
     BUSINESS MODE CONTROL
     - If page was loaded from /business/register → force business signup
     - Otherwise always customer signup
  ============================================================ */
  const [businessMode, setBusinessMode] = useState(forcedBusinessMode || false);

  useEffect(() => {
    if (forcedBusinessMode) {
      // Force business mode & update navbar state
      if (typeof window !== "undefined") {
        sessionStorage.setItem("businessNavMode", "1");
      }
      setBusinessMode(true);
    } else {
      // Always customer mode when coming from customer site
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("businessNavMode");
      }
      setBusinessMode(false);
    }
  }, [forcedBusinessMode]);

  /* ============================================================
     HOOKS (must stay in this order)
  ============================================================ */
  const [hydrated, setHydrated] = useState(false);
  const [checkingUser, setCheckingUser] = useState(true);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  /* 1. Hydration guard */
  useEffect(() => {
    setHydrated(true);
  }, []);

  /* 2. Redirect if already logged in */
  useEffect(() => {
    if (!hydrated) return;

    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const { data: profile } = await supabase
          .from("users")
          .select("role")
          .eq("id", session.user.id)
          .single();

        const dest =
          profile?.role === "business"
            ? "/business/dashboard"
            : "/dashboard";

        if (typeof window !== "undefined") {
          window.location.href = dest;
        } else {
          router.replace(dest);
        }
      } else {
        setCheckingUser(false);
      }
    }

    checkUser();
  }, [hydrated, supabase, router]);

  if (!hydrated || checkingUser) {
    return <div className="h-screen" />;
  }

  /* ============================================================
     SIGNUP LOGIC
  ============================================================ */
  async function handleRegister(e) {
    e.preventDefault();
    setLoading(true);

    /* 1️⃣ Create AUTH user */
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

    /* 2️⃣ Insert profile */
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

    /* 3️⃣ Update navbar mode */
    if (typeof window !== "undefined") {
      if (finalRole === "business") {
        sessionStorage.setItem("businessNavMode", "1");
      } else {
        sessionStorage.removeItem("businessNavMode");
      }
    }

    /* 4️⃣ Hard redirect to avoid blank page */
    const dest =
      finalRole === "business"
        ? "/business/dashboard"
        : "/dashboard";

    if (typeof window !== "undefined") {
      window.location.href = dest;
    } else {
      router.replace(dest);
    }
  }

  /* ============================================================
     UI
  ============================================================ */
  return (
    <div className="min-h-screen flex flex-col">
      <div className="w-full flex justify-center px-4 mt-24 grow text-white">
        <div className="max-w-md w-full max-h-[400px] p-8 rounded-2xl bg-black/25 backdrop-blur-xl border border-white/10 overflow-y-auto shadow-[0_0_60px_-12px_rgba(0,0,0,0.4)] animate-fadeIn">

          <h1 className="text-3xl font-extrabold text-center mb-3 tracking-tight">
            {businessMode ? "Create Business Account" : "Create Account"}
          </h1>

          <p className="text-center text-white/70 mb-6">
            {businessMode
              ? "Register your business"
              : "Join YourBarrio in seconds"}
          </p>

          <form onSubmit={handleRegister} className="space-y-4">
            <input
              type="email"
              placeholder={businessMode ? "Business Email" : "Email"}
              className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder-white/50 focus:ring-2 focus:ring-purple-500/40 focus:border-purple-400 transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <input
              type="password"
              placeholder="Password"
              className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder-white/50 focus:ring-2 focus:ring-purple-500/40 focus:border-purple-400 transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {/* 🚫 DROPDOWN REMOVED — role handled automatically */}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-xl font-semibold text-white text-lg bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-500 shadow-lg shadow-purple-500/30 hover:brightness-110 active:scale-[0.98] transition-all duration-200 ${
                loading ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {loading
                ? "Registering..."
                : businessMode
                ? "Create Business Account"
                : "Create Account"}
            </button>
          </form>

          <p className="text-center text-white/70 text-sm mt-4">
            Already have an account?{" "}
            <Link
              href={businessMode ? "/business/login" : "/login"}
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
