"use client";

import { useAuth } from "@/components/AuthProvider";

export default function AuthWrapper({ children }) {
  const { authUser } = useAuth();
  return <div key={authUser?.id || "guest"}>{children}</div>;
}
