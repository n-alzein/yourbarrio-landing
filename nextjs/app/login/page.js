"use client";

import { Suspense } from "react";          // ✅ Added
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

function LoginPageInner() {                // ✅ Wrapped original component
  const router = useRouter();
  const searchParams = useSearchParams();
  const { supabase } = useAuth();

  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const isBusinessLogin = searchParams.get("business") === "1";

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const { data: profile } = await supabase
          .from("users")
          .select("role")
          .eq("id", session.user.id)
          .single();

        router.replace(
          profile?.role === "business"
            ? "/business/dashboard"
            : "/customer/home"
        );
        return;
      }

      setCheckingAuth(false);
    }

    checkSession();
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const user = data.user;

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (isBusinessLogin && profile.role !== "business") {
      alert("Only business accounts can log in here.");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    router.push(
      profile.role === "business"
        ? "/business/dashboard"
        : "/customer/home"
    );

    setLoading(false);
  }

  if (checkingAuth) {
    return <div className="min-h-screen bg-black" />;
  }

  // === UI stays EXACTLY as you wrote ===
  return (
    <div className="min-h-screen flex flex-col">
      <div className="w-full flex justify-center px-4 mt-24 grow text-white">
        <div
          className="
            max-w-md w-full 
            max-h-[380px]
            p-8
            rounded-2xl 
            bg-black/25
            backdrop-blur-xl
            border border-white/10
            overflow-y-auto
            shadow-[0_0_50px_-12px_rgba(0,0,0,0.4)]
            animate-fadeIn
          "
        >
          <h1 className="text-3xl font-extrabold text-center mb-3 tracking-tight">
            {isBusinessLogin ? "Business Login" : "Welcome Back"}
          </h1>

          <p className="text-center text-white/70 mb-6">
            {isBusinessLogin
              ? "Sign in to manage your business"
              : "Sign in to continue"}
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              className="
                w-full px-4 py-3 rounded-xl 
                bg-black/30
                border border-white/10 
                text-white placeholder-white/40
                focus:ring-2 focus:ring-pink-500/40 
                focus:border-pink-400
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
                bg-black/30
                border border-white/10 
                text-white placeholder-white/40
                focus:ring-2 focus:ring-pink-500/40 
                focus:border-pink-400
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
                shadow-lg shadow-purple-500/30 
                hover:brightness-110 active:scale-[0.98]
                transition-all duration-200
                ${loading ? "opacity-60 cursor-not-allowed" : ""}
              `}
            >
              {loading ? "Signing in..." : "Log in"}
            </button>
          </form>

          <p className="text-center text-white/70 text-sm mt-4">
            Don’t have an account?{" "}
            <a
              href={isBusinessLogin ? "/business/register" : "/register"}
              className="text-pink-400 font-medium hover:underline"
            >
              Sign up
            </a>
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

/* ============================================================
   EXPORT — Suspense wrapper (fix for Vercel build)
============================================================ */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
