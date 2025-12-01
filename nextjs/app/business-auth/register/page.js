"use client";

import { Suspense } from "react";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

function BusinessRegisterInner() {
  const router = useRouter();
  const { supabase, authUser, role, loadingUser } = useAuth();

  const [loading, setLoading] = useState(false);

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");

  /* --------------------------------------------------------------
     AUTO-REDIRECT IF ALREADY LOGGED IN
  -------------------------------------------------------------- */
  useEffect(() => {
    if (loadingUser) return;

    if (authUser) {
      if (role === "business") {
        router.replace("/business/dashboard");
      } else {
        router.replace("/customer/home");
      }
    }
  }, [authUser, role, loadingUser, router]);

  /* --------------------------------------------------------------
     BUSINESS SIGNUP HANDLER
  -------------------------------------------------------------- */
  async function handleRegister(e) {
    e.preventDefault();
    setLoading(true);

    // 1. Basic auth sign up
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

    // 2. Create business row in `public.users`
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

    // 3. Redirect to business dashboard
    router.push("/business/dashboard");
    setLoading(false);
  }

  /* --------------------------------------------------------------
     AUTH LOADING SCREEN
  -------------------------------------------------------------- */
  if (loadingUser) {
    return <div className="min-h-screen bg-black" />;
  }

  /* --------------------------------------------------------------
     UI (unchanged original style)
  -------------------------------------------------------------- */
  return (
    <div className="min-h-screen flex flex-col">
      <div className="w-full flex justify-center px-4 mt-20 grow text-white">
        <div
          className="
            max-w-md w-full 
            p-8 rounded-2xl 
            bg-black/25 backdrop-blur-xl 
            border border-white/10
            shadow-[0_0_40px_-12px_rgba(0,0,0,0.4)]
            animate-fadeIn
          "
        >
          <h1 className="text-3xl font-extrabold text-center mb-3 tracking-tight">
            Create a Business Account
          </h1>

          <p className="text-center text-white/70 mb-6">
            Start reaching local customers today
          </p>

          {/* ---------------- SIGNUP FORM ---------------- */}
          <form onSubmit={handleRegister} className="space-y-4">

            <input
              type="text"
              placeholder="Business Name"
              className="
                w-full px-4 py-3 rounded-xl 
                bg-black/30 border border-white/10 
                text-white placeholder-white/40
                focus:ring-2 focus:ring-fuchsia-500/40 
                focus:border-fuchsia-400
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
                text-white placeholder-white/40
                focus:ring-2 focus:ring-fuchsia-500/40 
                focus:border-fuchsia-400
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
                text-white placeholder-white/40
                focus:ring-2 focus:ring-fuchsia-500/40 
                focus:border-fuchsia-400
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
                shadow-lg shadow-fuchsia-500/30 
                hover:brightness-110 active:scale-[0.98]
                transition-all duration-200
                ${loading ? "opacity-60 cursor-not-allowed" : ""}
              `}
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          {/* ---------------- LOGIN LINK ---------------- */}
          <p className="text-center text-white/70 text-sm mt-4">
            Already have an account?{" "}
            <a
              href="/business-auth/login"
              className="text-pink-400 font-medium hover:underline"
            >
              Log in
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
   EXPORT (Suspense wrapper)
-------------------------------------------------------------- */
export default function BusinessRegisterPage() {
  return (
    <Suspense fallback={null}>
      <BusinessRegisterInner />
    </Suspense>
  );
}
