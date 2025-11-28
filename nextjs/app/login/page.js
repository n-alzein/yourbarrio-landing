"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createBrowserClient();

  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ⛔ Prevent access to login when logged in
  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
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

  // 🔐 Handle Login
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
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    router.push(
      profile.role === "business"
        ? "/business/dashboard"
        : "/customer/home"
    );
  }

  if (checkingAuth) {
    return <div className="min-h-screen bg-black" />;
  }

  return (
    <div
      className="
        min-h-screen w-full 
        bg-transparent        // page fully transparent
        flex items-center justify-center 
        px-4 py-12
        text-white
      "
    >
        {/* Glass Card */}
        <div
          className="
            max-w-md w-full p-10 rounded-2xl 
            bg-black/25          // 👈 25% transparent BLACK
            backdrop-blur-xl     // 👈 frosted-glass effect
            border border-white/10
            shadow-[0_0_50px_-12px_rgba(0,0,0,0.4)]
            animate-fadeIn
          "
        >
          {/* Title */}
          <h1 className="text-4xl font-extrabold text-center mb-2 tracking-tight">
            Welcome Back
          </h1>
  
          <p className="text-center text-white/70 mb-8">
            Sign in to continue
          </p>
  
          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <input
              type="email"
              placeholder="Email"
              className="
                w-full px-4 py-3.5 rounded-xl 
                bg-black/30        // input dark glass
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
                w-full px-4 py-3.5 rounded-xl 
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
                w-full py-3.5 rounded-xl font-semibold text-white text-lg
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
  
          <p className="text-center text-white/70 text-sm mt-6">
            Don’t have an account?{" "}
            <a href="/register" className="text-pink-400 font-medium hover:underline">
              Sign up
            </a>
          </p>
        </div>
  
        {/* Animations */}
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
