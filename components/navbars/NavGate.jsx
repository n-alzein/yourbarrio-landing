"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function NavGate({ children }) {
  const pathname = usePathname() || "";
  const { user, role, loadingUser } = useAuth();

  const isAppRoute =
    pathname.startsWith("/customer") ||
    pathname.startsWith("/business") ||
    pathname.startsWith("/business-auth") ||
    pathname.startsWith("/listings");

  // Hide public nav:
  // - on any app route
  // - while auth is loading (avoid flash of login/signup)
  // - when signed in
  if (!pathname) return null;
  if (isAppRoute) return null;
  if (loadingUser) return null;
  if (user || role) return null;

  return children;
}
