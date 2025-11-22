"use client";

import { useEffect, useState } from "react";
import Navbar from "./Navbar";
import { supabaseClient } from "@/lib/supabase";

export default function NavbarClient() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const { data, error } = await supabaseClient.auth.getUser();
      if (!mounted) return;
      if (error) {
        console.error("Navbar auth error:", error.message);
        setUser(null);
      } else {
        setUser(data.user ?? null);
      }
      setLoading(false);
    }

    loadUser();

    // also listen for login/logout changes
    const { data: sub } = supabaseClient.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  // Optional: while loading, treat as logged-out to avoid flicker
  if (loading) return <Navbar user={null} />;

  return <Navbar user={user} />;
}
