"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import HomeRenderTrace from "@/components/debug/HomeRenderTrace";

const diagEnabled = () => process.env.NEXT_PUBLIC_CLICK_DIAG === "1";

export default function HomeGuard({ children, fallback = null }) {
  const router = useRouter();
  const { authUser, user: profile, role, loadingUser } = useAuth();

  const blocker = useMemo(() => {
    if (loadingUser) return "AUTH_LOADING";
    if (!authUser) return "NO_USER";
    if (!profile) return "NO_PROFILE";
    if (role && role !== "customer") return "ROLE_MISMATCH";
    return null;
  }, [authUser, loadingUser, profile, role]);

  useEffect(() => {
    if (blocker === "NO_USER") {
      router.replace("/auth/login");
    }
    if (blocker === "ROLE_MISMATCH") {
      router.replace("/business/dashboard");
    }
  }, [blocker, router]);

  const message = (() => {
    switch (blocker) {
      case "AUTH_LOADING":
        return "Loading your account…";
      case "NO_USER":
        return "Redirecting to login…";
      case "NO_PROFILE":
        return "Loading profile…";
      case "ROLE_MISMATCH":
        return "Switching account…";
      default:
        return null;
    }
  })();

  if (blocker) {
    return (
      <>
        {fallback || null}
        <HomeRenderTrace blocker={blocker} />
      </>
    );
  }

  return (
    <>
      <HomeRenderTrace blocker={blocker} />
      {children}
    </>
  );
}
