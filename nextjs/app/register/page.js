"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabaseClient";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  async function register(e) {
    e.preventDefault();
    setStatus("Registering...");

    const { error } = await supabaseClient.auth.signUp({
      email,
      password,
    });

    if (error) {
      setStatus("Error: " + error.message);
      return;
    }

    setStatus("Success! Check your email to confirm.");
  }

  return (
    <div className="flex flex-col items-center pt-20">
      <h1 className="text-3xl font-bold mb-6">Create an Account</h1>

      <form onSubmit={register} className="flex flex-col gap-4 w-80">
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
          placeholder="Password (min 6 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button className="bg-purple-600 text-white p-2 rounded">
          Register
        </button>

        <p>{status}</p>
      </form>
    </div>
  );
}
