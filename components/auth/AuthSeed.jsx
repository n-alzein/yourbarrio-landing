"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";

export default function AuthSeed({ user = null, profile = null, role = null }) {
  const { seedAuthState } = useAuth();

  useEffect(() => {
    if (typeof seedAuthState !== "function") return;
    seedAuthState({
      initialUser: user ?? null,
      initialProfile: profile ?? null,
      initialRole: role ?? null,
    });
  }, [seedAuthState, user, profile, role]);

  return null;
}
