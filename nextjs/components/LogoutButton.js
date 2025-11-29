"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

export default function LogoutButton({ children, className = "", mobile }) {
  const { supabase, setRole, setUser } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();

    // 🔥 Immediately clear local auth state
    if (setUser) setUser(null);
    if (setRole) setRole(null);

    // Refresh UI
    router.refresh();

    // Redirect home
    router.push("/");
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
