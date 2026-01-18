"use client";

import { useAuth } from "@/components/AuthProvider";

export default function AuthWrapper({ children }) {
  const { user } = useAuth();
  return <div key={user?.id || "guest"}>{children}</div>;
}
