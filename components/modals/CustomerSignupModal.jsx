"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BaseModal from "./BaseModal";
import { useAuth } from "../AuthProvider";
import { useModal } from "./ModalProvider";

export default function CustomerSignupModal({ onClose }) {
  const router = useRouter();
  const { supabase } = useAuth();
  const { openModal } = useModal();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignup(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    const authUser = signUpData?.user;
    if (!authUser) {
      setError("Signup succeeded but no user returned. Try logging in.");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("users").insert({
      id: authUser.id,
      email: authUser.email,
      role: "customer",
      full_name: "",
    });

    if (insertError) {
      setError("Account created, but failed to finish profile. Try logging in.");
      setLoading(false);
      return;
    }

    onClose?.();
    router.push("/customer/home");
    router.refresh();
    setLoading(false);
  }

  async function handleGoogleSignup() {
    setError("");
    setLoading(true);

    const origin =
      typeof window !== "undefined" ? window.location.origin : "";

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/customer/home` },
    });

    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
      return;
    }

    onClose?.();
  }

  return (
    <BaseModal
      title="Create your customer account"
      description="Join YourBarrio to save your favorite local businesses and see recommendations near you."
      onClose={onClose}
    >
      <form onSubmit={handleSignup} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm text-slate-700">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="
              w-full px-4 py-3 rounded-xl 
              bg-slate-50 border border-slate-200 
              text-slate-900 placeholder-slate-400
              focus:ring-2 focus:ring-purple-500/40 focus:border-purple-400
              transition
            "
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-slate-700">Password</label>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="
              w-full px-4 py-3 rounded-xl 
              bg-slate-50 border border-slate-200 
              text-slate-900 placeholder-slate-400
              focus:ring-2 focus:ring-purple-500/40 focus:border-purple-400
              transition
            "
            disabled={loading}
          />
        </div>

        {error ? (
          <div className="rounded-lg border border-red-500/20 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className={`
            w-full py-3 rounded-xl font-semibold text-white text-base
            bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-500
            shadow-lg hover:brightness-110 active:scale-[0.97]
            transition-all duration-200
            ${loading ? "opacity-60 cursor-not-allowed" : ""}
          `}
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <div className="mt-4">
        <button
          type="button"
          onClick={handleGoogleSignup}
          disabled={loading}
          className="
            w-full py-3 rounded-xl font-medium
            bg-white border border-slate-200 text-slate-900
            hover:bg-slate-50
            flex items-center justify-center gap-2
            transition
            disabled:opacity-60 disabled:cursor-not-allowed
          "
        >
          <img src="/google-icon.svg" className="h-5 w-5" alt="Google" />
          Continue with Google
        </button>
      </div>

      <p className="mt-4 text-center text-sm text-slate-700">
        Already have an account?{" "}
        <button
          type="button"
          onClick={() => openModal("customer-login")}
          className="text-pink-600 font-semibold hover:underline"
        >
          Log in
        </button>
      </p>
    </BaseModal>
  );
}
