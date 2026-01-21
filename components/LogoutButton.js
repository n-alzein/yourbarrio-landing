"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRef, useState } from "react";

export default function LogoutButton({
  children,
  className = "",
  mobile,
  onSuccess,
}) {
  const { logout } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const resetTimerRef = useRef(null);

  async function handleClick() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await logout();
      onSuccess?.();
    } catch (err) {
      console.error("Logout failed", err);
    } finally {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = setTimeout(() => {
        setIsSubmitting(false);
      }, 500);
    }
  }

  if (mobile) {
    return (
      <button
        onClick={handleClick}
        type="button"
        disabled={isSubmitting}
        className={`px-4 py-2 text-left text-white rounded-lg ${
          isSubmitting ? "opacity-60 cursor-not-allowed" : "hover:bg-white/10"
        }`}
      >
        {isSubmitting ? "Logging out..." : "Log out"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isSubmitting}
      className={`${className} ${isSubmitting ? "opacity-60 cursor-not-allowed" : ""}`}
    >
      {isSubmitting ? "Logging out..." : children}
    </button>
  );
}
