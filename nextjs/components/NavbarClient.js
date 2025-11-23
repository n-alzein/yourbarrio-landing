"use client";

import { useEffect, useState } from "react";
import Navbar from "./Navbar";
import { createBrowserClient } from "@/lib/supabaseClient";

export default function NavbarClient() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabaseClient = createBrowserClient(); // <-- defined in effect scope
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

    const { data: sub } = supabaseClient.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  if (loading) return <Navbar user={null} />;
  return <Navbar user={user} />;
}
