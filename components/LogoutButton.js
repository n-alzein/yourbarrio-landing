"use client";

import { useAuth } from "@/components/AuthProvider";

export default function LogoutButton({ children, className = "", mobile }) {
  const { logout } = useAuth();

  function handleClick() {
    logout(); // new global logout function handles everything
  }

  if (mobile) {
    return (
      <button
        onClick={handleClick}
        className="px-4 py-2 text-left text-white hover:bg-white/10 rounded-lg"
      >
        Log out
      </button>
    );
  }

  return (
    <button onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
