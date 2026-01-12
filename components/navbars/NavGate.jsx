"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function NavGate({ children }) {
  const pathname = usePathname();
  const { user, role } = useAuth();

  if (!pathname) {
    // Wait for next/navigation to resolve the current route so we don't flash the public shell.
    return null;
  }

  const isAppRoute =
    pathname.startsWith("/customer") ||
    pathname.startsWith("/business") ||
    pathname.startsWith("/business-auth") ||
    pathname.startsWith("/listings");
  const isPublicBusinessProfile = pathname.startsWith("/b");

  // Hide public nav:
  // - on any app route
  // - when signed in
  if (isAppRoute) return null;
  if ((user || role) && !isPublicBusinessProfile) return null;

  return children;
}
