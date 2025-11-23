"use client";

import { useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const router = useRouter();

  async function login(e) {
    e.preventDefault();
    setStatus("Logging in...");

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatus("Error: " + error.message);
      return;
    }

    setStatus("Success! Redirecting...");
    router.push("/profile");
  }

  return (
    <div className="flex flex-col items-center pt-20">
      <h1 className="text-3xl font-bold mb-6">Login</h1>

      <form onSubmit={login} className="flex flex-col gap-4 w-80">
        <input
          type="email"
          className="border p-2 rounded"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          className="border p-2 rounded"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button className="bg-purple-600 text-white p-2 rounded">
          Login
        </button>

        <p>{status}</p>
      </form>
    </div>
  );
}
