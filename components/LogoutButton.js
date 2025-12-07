"use client";

import { useAuth } from "@/components/AuthProvider";
import { useState } from "react";

export default function LogoutButton({
  children,
  className = "",
  mobile,
  onSuccess,
}) {
  const { logout } = useAuth();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    const reset = () => setLoading(false);

    try {
      await logout(); // global logout handles everything
      onSuccess?.();
    } catch (err) {
      console.error("Logout failed", err);
      reset();
      return;
    }

    // If navigation didn't unmount this component, ensure the button unlocks
    setTimeout(reset, 500);
  }

  if (mobile) {
    return (
      <button
        onClick={handleClick}
        type="button"
        disabled={loading}
        className={`px-4 py-2 text-left text-white rounded-lg ${
          loading ? "opacity-60 cursor-not-allowed" : "hover:bg-white/10"
        }`}
      >
        {loading ? "Logging out..." : "Log out"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`${className} ${loading ? "opacity-60 cursor-not-allowed" : ""}`}
    >
      {loading ? "Logging out..." : children}
    </button>
  );
}
