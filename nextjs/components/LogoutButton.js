"use client";

import { createBrowserClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LogoutButton({ mobile }) {
  const router = useRouter();

  async function logout() {
    await supabaseClient.auth.signOut();
    router.push("/login");
  }

  return (
    <button
      onClick={logout}
      className={
        mobile
          ? "text-red-600 hover:text-red-700 text-left"
          : "bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
      }
    >
      Logout
    </button>
  );
}
