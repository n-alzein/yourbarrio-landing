"use client";

import { Suspense } from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient";


function CustomerLoginInner() {
  const router = useRouter();
  const { supabase, authUser, role, loadingUser } = useAuth();

  const [loading, setLoading] = useState(false);

  // form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");


/* --------------------------------------------------------------
   AUTO-REDIRECT IF ALREADY LOGGED IN
-------------------------------------------------------------- */
useEffect(() => {
    if (loadingUser) return;
  
    // ⛔ WAIT until role is loaded to avoid wrong redirect
    if (!authUser || !role) return;
  
    if (role === "business") {
      router.replace("/business/dashboard");
    } else {
      router.replace("/customer/home");
    }
  }, [authUser, role, loadingUser, router]);
  

  /* --------------------------------------------------------------
     EMAIL/PASSWORD LOGIN
  -------------------------------------------------------------- */
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

    // Fetch user role
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "business") {
      router.push("/business/dashboard");
    } else {
      router.push("/customer/home");
    }

    setLoading(false);
  }

  /* --------------------------------------------------------------
     GOOGLE LOGIN — CUSTOMER ONLY
  -------------------------------------------------------------- */
  async function handleGoogleLogin() {
    const client = getBrowserSupabaseClient();  // ensures same PKCE client
  
    // Force PKCE initialization BEFORE signIn
    await client.auth.getSession();
  
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/oauth/callback`,
      },
    });
  
    if (error) console.error(error);
  }
  
  /* --------------------------------------------------------------
     AUTH LOADING
  -------------------------------------------------------------- */
  if (loadingUser) {
    return <div className="min-h-screen bg-black" />;
  }

  /* --------------------------------------------------------------
     UI (unchanged original style)
  -------------------------------------------------------------- */
  return (
    <div className="min-h-screen flex flex-col">
      <div className="w-full flex justify-center px-4 mt-24 grow text-white">
        <div
          className="
            max-w-md w-full 
            max-h-[420px]
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
            Welcome Back
          </h1>

          <p className="text-center text-white/70 mb-6">
            Sign in to continue exploring your neighborhood
          </p>

          {/* ---------------- EMAIL/PASSWORD FORM ---------------- */}
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
                bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500
                shadow-lg shadow-pink-500/30 
                hover:brightness-110 active:scale-[0.98]
                transition-all duration-200
                ${loading ? "opacity-60 cursor-not-allowed" : ""}
              `}
            >
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>

          {/* ---------------- GOOGLE LOGIN ---------------- */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="
              w-full mt-5 py-3 rounded-xl font-medium
              bg-white/10 border border-white/20
              hover:bg-white/20
              flex items-center justify-center gap-2
              transition
            "
          >
            <img src="/google-icon.svg" className="h-5 w-5" alt="Google" />
            Continue with Google
          </button>

          {/* ---------------- SIGNUP LINK ---------------- */}
          <p className="text-center text-white/70 text-sm mt-4">
            Don't have an account?{" "}
            <a
              href="/auth/register"
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

/* --------------------------------------------------------------
   EXPORT (Suspense compatibility)
-------------------------------------------------------------- */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <CustomerLoginInner />
    </Suspense>
  );
}
