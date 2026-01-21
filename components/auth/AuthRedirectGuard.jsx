"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { PATHS } from "@/lib/auth/paths";

export default function AuthRedirectGuard({ children, redirectTo }) {
  const { authStatus, user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const fallbackArmedRef = useRef(false);

  useEffect(() => {
    if (authStatus === "loading") return;
    if (authStatus === "authenticated" && user) return;

    const target =
      redirectTo ||
      (pathname?.startsWith("/business")
        ? PATHS.auth.businessLogin
        : PATHS.auth.customerLogin);

    if (!target) return;
    if (pathname === target || pathname === `${target}/`) return;

    router.replace(target);
    router.refresh();

    if (typeof window !== "undefined" && !fallbackArmedRef.current) {
      fallbackArmedRef.current = true;
      const currentPath = `${window.location.pathname}${window.location.search}`;
      setTimeout(() => {
        const nextPath = `${window.location.pathname}${window.location.search}`;
        if (nextPath === currentPath) {
          window.location.assign(target);
        }
      }, 350);
    }
  }, [authStatus, pathname, redirectTo, router, user]);

  if (authStatus === "loading") return null;
  if (authStatus !== "authenticated" || !user) return null;
  return <>{children}</>;
}
