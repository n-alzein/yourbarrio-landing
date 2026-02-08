"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";

export default function AuthSeed({
  user = null,
  profile = null,
  role = null,
  supportModeActive = false,
}) {
  const { seedAuthState } = useAuth();

  useEffect(() => {
    if (typeof seedAuthState !== "function") return;
    seedAuthState({
      initialUser: user ?? null,
      initialProfile: profile ?? null,
      initialRole: role ?? null,
      supportModeActive: Boolean(supportModeActive),
    });
  }, [seedAuthState, user, profile, role, supportModeActive]);

  return null;
}
