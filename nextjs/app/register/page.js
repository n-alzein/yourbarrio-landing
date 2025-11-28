"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabaseClient";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createBrowserClient();

  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [role, setRole] = useState("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  /* ---------------------------------------------------------
     🚫 BLOCK SIGN-UP PAGE IF USER IS LOGGED IN
  --------------------------------------------------------- */
  useEffect(() => {
    async function checkUser() {
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
            : "/dashboard"
        );
      } else {
        setInitializing(false);
      }
    }

    checkUser();
  }, []);

  if (initializing) return null;

  /* ---------------------------------------------------------
     📝 HANDLE SIGNUP
  --------------------------------------------------------- */
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

    const user = signUpData.user;

    if (!user) {
      alert("Signup failed: no user returned.");
      setLoading(false);
      return;
    }

    const safeRole = role || "customer";

    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      email: user.email,
      role: safeRole,
      full_name: "",
    });

    if (insertError) {
      console.error("Profile Insert Error:", insertError);
      alert("Failed to create profile row.");
      setLoading(false);
      return;
    }

    router.push(
      safeRole === "business"
        ? "/business/dashboard"
        : "/dashboard"
    );
  }

  /* ---------------------------------------------------------
     💄 UI
  --------------------------------------------------------- */
  return (
    <div
      className="
        min-h-screen w-full
        bg-transparent            // 👈 fully transparent page background
        flex items-center justify-center 
        px-4 py-10 text-white
      "
    >
      <div
        className="
          max-w-md w-full p-10 rounded-2xl 
          bg-black/25             // 👈 25% transparent black inside signup box
          backdrop-blur-xl        // 👈 frosted glass effect
          border border-white/10
          shadow-[0_0_60px_-10px_rgba(0,0,0,0.4)]
          animate-fadeIn
        "
      >
        {/* 🚫 LOGO REMOVED */}

        <h1 className="text-4xl font-extrabold text-center mb-2 tracking-tight">
          Create Account
        </h1>

        <p className="text-center text-white/70 mb-8">
          Join YourBarrio in seconds
        </p>

        <form onSubmit={handleRegister} className="space-y-6">

          {/* EMAIL */}
          <input
            type="email"
            placeholder="Email"
            className="
              w-full px-4 py-3.5 rounded-xl 
              bg-black/20
              border border-white/10 
              text-white placeholder-white/50 
              focus:ring-2 focus:ring-purple-500/40 
              focus:border-purple-400
              transition
            "
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {/* PASSWORD */}
          <input
            type="password"
            placeholder="Password"
            className="
              w-full px-4 py-3.5 rounded-xl 
              bg-black/20
              border border-white/10 
              text-white placeholder-white/50 
              focus:ring-2 focus:ring-purple-500/40 
              focus:border-purple-400
              transition
            "
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {/* ROLE */}
          <select
            className="
              w-full px-4 py-3.5 rounded-xl 
              bg-black/20
              border border-white/10 
              text-white
              focus:ring-2 focus:ring-purple-500/40 
              focus:border-purple-400
              transition
            "
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="customer" className="text-black">Customer</option>
            <option value="business" className="text-black">Business</option>
          </select>

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
            {loading ? "Registering..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-white/80 text-sm mt-6">
          Already have an account?{" "}
          <a href="/login" className="text-pink-400 font-medium hover:underline">
            Log in
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
