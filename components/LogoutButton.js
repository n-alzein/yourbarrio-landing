"use client";

import { useAuth } from "@/components/AuthProvider";

export default function LogoutButton({
  children,
  className = "",
  mobile,
  onSuccess,
}) {
  const { logout } = useAuth();

  async function handleClick() {
    try {
      await logout(); // global logout handles everything
      onSuccess?.();
    } catch (err) {
      console.error("Logout failed", err);
    }
  }

  if (mobile) {
    return (
      <button
        onClick={handleClick}
        type="button"
        className="px-4 py-2 text-left text-white hover:bg-white/10 rounded-lg"
      >
        Log out
      </button>
    );
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
