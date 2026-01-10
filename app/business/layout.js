"use client";

import BusinessNavbar from "@/components/navbars/BusinessNavbar";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect } from "react";
import { getCookieName } from "@/lib/supabaseClient";

function BusinessRouteShell({ children = null }) {
  return <div className="pt-8 md:pt-10 min-h-screen">{children}</div>;
}

export default function BusinessLayout({ children }) {
  const { authUser, role, loadingUser } = useAuth();
  const router = useRouter();

  const waitForAuthCookie = useCallback(async (timeoutMs = 2500) => {
    if (typeof document === "undefined") return false;
    const cookieName = getCookieName();
    if (!cookieName) return false;

    const hasAuthCookie = () => {
      const names = document.cookie
        .split(";")
        .map((entry) => entry.trim().split("=")[0])
        .filter(Boolean);
      return names.some(
        (name) => name === cookieName || name.startsWith(`${cookieName}.`)
      );
    };

    if (hasAuthCookie()) return true;

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (hasAuthCookie()) return true;
    }

    return false;
  }, []);

  // Redirect the opener tab to dashboard when a popup login succeeds
  useEffect(() => {
    function handleStorage(event) {
      if (event.key === "business_auth_success") {
        const redirectTarget =
          localStorage.getItem("business_auth_redirect") ||
          "/business/dashboard";

        // Clear hint so future logins don't reuse it
        localStorage.removeItem("business_auth_redirect");

        waitForAuthCookie().finally(() => {
          window.location.assign(redirectTarget);
        });
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [router, waitForAuthCookie]);

  useEffect(() => {
    if (loadingUser) return;

    // Not logged in → allow login page to show
    if (!authUser) return;

    // Logged in but NOT business → redirect away
    if (role && role !== "business") {
      router.replace("/customer/home");
    }
  }, [authUser, role, loadingUser, router]);

  // Avoid flicker on load
  if (loadingUser) return <div className="min-h-screen" />;

  return (
    <Suspense fallback={<BusinessRouteShell />}>
      <BusinessNavbar />
      <BusinessRouteShell>{children}</BusinessRouteShell>
    </Suspense>
  );
}
