"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

export default function LogoutButton({ children, className = "", mobile }) {
  const { supabase } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();

    // IMPORTANT: refresh the entire app state
    router.refresh();

    // Optional redirect
    router.push("/login");
  }

  if (mobile) {
    return (
      <button
        onClick={handleLogout}
        className="px-4 py-2 text-left text-white hover:bg-white/10 rounded-lg"
      >
        Logout
      </button>
    );
  }

  return (
    <button onClick={handleLogout} className={className}>
      {children}
    </button>
  );
}
